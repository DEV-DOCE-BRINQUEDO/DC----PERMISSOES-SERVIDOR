const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execAsync = util.promisify(exec);

// In-memory cache por servidor. TTL = 5 minutos
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) { cache.set(key, { ts: Date.now(), data }); }
function clearCache(serverId) {
  for (const key of cache.keys()) { if (key.startsWith(serverId + ':')) cache.delete(key); }
}

// Executa um script PS1 temporario
async function runPS1(scriptContent) {
  const tmp = path.join(os.tmpdir(), `dc_rpc_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);
  fs.writeFileSync(tmp, '\ufeff' + scriptContent, 'utf8'); // BOM para garantir UTF-8
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmp}"`,
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

/**
 * Converte um rootPath configurado pelo usuario para o caminho UNC correto.
 *
 * Exemplos de rootPath aceitos:
 *   ""          → \\IP\C$          (raiz do C por padrao)
 *   "D:"        → \\IP\D$          (raiz do disco D)
 *   "D:\\"      → \\IP\D$
 *   "D:\\dados" → \\IP\D$\dados
 *   "dados"     → \\IP\C$\dados    (subpasta relativa em C)
 *
 * Retorna { unc, share, relPath }
 * - unc: caminho UNC completo para PowerShell
 * - share: o share administrativo (ex: D$)
 * - relPath: caminho relativo ao share (ex: dados/clientes)
 */
function resolveUNC(ip, rootPath) {
  const rp = (rootPath || '').trim().replace(/\\/g, '/');

  // Detecta se começa com letra de disco (ex: "D:" ou "D:/...")
  const driveMatch = rp.match(/^([A-Za-z]):\/?(.*)$/);

  let drive = 'C';
  let subPath = '';

  if (driveMatch) {
    drive = driveMatch[1].toUpperCase();
    subPath = driveMatch[2].replace(/^\/+/, ''); // remove barras iniciais
  } else {
    subPath = rp.replace(/^\/+/, '');
  }

  const share = `${drive}$`;
  const uncBase = `\\\\${ip}\\${share}`;
  const unc = subPath ? `${uncBase}\\${subPath.replace(/\//g, '\\')}` : uncBase;

  return { unc, share, drive, subPath };
}

class WindowsRPC {
  static clearCache(serverId) { clearCache(serverId); }

  static async connect(ip, username, password) {
    try { await execAsync(`net use \\\\${ip}\\IPC$ /delete /y`); } catch (_) {}
    const cmd = `net use \\\\${ip}\\IPC$ "${password}" /user:"${username}"`;
    await execAsync(cmd);
    return true;
  }

  static async getUsers(serverId, ip) {
    const key = `${serverId}:users`;
    const cached = getCache(key);
    if (cached) return cached;

    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$adsi = [ADSI]"WinNT://${ip}"
$result = @()
$users = $adsi.Children | Where-Object { $_.SchemaClassName -eq 'User' }
foreach ($u in $users) {
    $result += [PSCustomObject]@{ Name = [string]$u.Name }
}
ConvertTo-Json $result
`;
    const stdout = await runPS1(script);
    if (!stdout.trim() || stdout.trim() === 'null') return [];
    let data;
    try { data = JSON.parse(stdout.trim()); } catch { return []; }
    if (!Array.isArray(data)) data = [data];

    const users = data.map((u, i) => ({
      id: `usr_${i}_${u.Name}`,
      name: u.Name,
      username: u.Name,
      email: `${u.Name}@${ip}`,
      role: 'user',
      status: 'active',
      groups: [],
      createdAt: new Date().toISOString()
    }));
    setCache(key, users);
    return users;
  }

  static async getGroups(serverId, ip) {
    const key = `${serverId}:groups`;
    const cached = getCache(key);
    if (cached) return cached;

    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$adsi = [ADSI]"WinNT://${ip}"
$result = @()
$groups = $adsi.Children | Where-Object { $_.SchemaClassName -eq 'Group' }
foreach ($g in $groups) {
    $result += [PSCustomObject]@{ Name = [string]$g.Name }
}
ConvertTo-Json $result
`;
    const stdout = await runPS1(script);
    if (!stdout.trim() || stdout.trim() === 'null') return [];
    let data;
    try { data = JSON.parse(stdout.trim()); } catch { return []; }
    if (!Array.isArray(data)) data = [data];

    const groups = data.map((g, i) => ({
      id: `grp_${i}_${g.Name}`,
      name: g.Name,
      description: 'Grupo local do Windows Server',
      members: [],
      createdAt: new Date().toISOString()
    }));
    setCache(key, groups);
    return groups;
  }

  /**
   * Carrega arvore completa de pastas (com profundidade configuravel).
   * rootPath define o disco e pasta inicial (ex: "D:", "D:\\dados", "server")
   */
  static async getFoldersRecursive(serverId, ip, rootPath = '', depth = 2) {
    const key = `${serverId}:tree:${rootPath}`;
    const cached = getCache(key);
    if (cached) return cached;

    const { unc, subPath } = resolveUNC(ip, rootPath);
    const startRel = subPath ? subPath.replace(/\\/g, '/') : '';

    const script = `
$ErrorActionPreference = 'SilentlyContinue'
function Get-Tree($p, $rel, $depth) {
    if ($depth -le 0) { return }
    $dirs = Get-ChildItem -LiteralPath $p -Directory -ErrorAction SilentlyContinue
    foreach ($d in $dirs) {
        $childRel = if ($rel) { "$rel/$($d.Name)" } else { $d.Name }
        Write-Output "$childRel"
        Get-Tree $d.FullName $childRel ($depth - 1)
    }
}
Get-Tree "${unc}" "${startRel}" ${depth}
`;
    const stdout = await runPS1(script);
    const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);

    const nodeMap = {};
    const roots = [];

    for (const relPath of lines) {
      const parts = relPath.split('/');
      const name = parts[parts.length - 1];
      const parent = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      const id = `fld_${Buffer.from(relPath).toString('base64').replace(/[+=]/g, '')}`;

      const node = { id, name, path: relPath, parentPath: parent || '/', children: [] };
      nodeMap[relPath] = node;

      if (!parent) {
        roots.push(node);
      } else if (nodeMap[parent]) {
        nodeMap[parent].children.push(node);
      }
    }

    setCache(key, roots);
    return roots;
  }

  /**
   * Lista apenas um nivel (lazy load ao expandir).
   * parentPath pode ser um path relativo (ex: "dados/clientes") OU um path de disco (ex: "D:")
   */
  static async getFolders(serverId, ip, rootPath = '', parentPath = '') {
    const cacheKey = `${serverId}:dir:${parentPath}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    // Se parentPath veio vazio, usa o rootPath do servidor como ponto de partida
    const effectivePath = parentPath || rootPath;
    const { unc } = resolveUNC(ip, effectivePath);

    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @()
$dirs = Get-ChildItem -LiteralPath "${unc}" -Directory -ErrorAction SilentlyContinue
foreach ($d in $dirs) {
    $result += [PSCustomObject]@{ Name = [string]$d.Name }
}
ConvertTo-Json $result
`;
    const stdout = await runPS1(script);
    if (!stdout.trim() || stdout.trim() === 'null') return [];
    let data;
    try { data = JSON.parse(stdout.trim()); } catch { return []; }
    if (!Array.isArray(data)) data = [data];

    const folders = data.map(d => {
      const relPath = parentPath ? `${parentPath}/${d.Name}` : d.Name;
      return {
        id: `fld_${Buffer.from(relPath).toString('base64').replace(/[+=]/g, '')}`,
        name: d.Name,
        path: relPath,
        parentPath: parentPath || '/',
        children: []
      };
    });
    setCache(cacheKey, folders);
    return folders;
  }

  static async getPermissions(serverId, ip, rootPath = '', folderPath) {
    const key = `${serverId}:perms:${folderPath}`;
    const cached = getCache(key);
    if (cached) return cached;

    const { unc } = resolveUNC(ip, folderPath);
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @()
$acl = Get-Acl -LiteralPath "${unc}" -ErrorAction SilentlyContinue
if ($acl) {
    foreach ($access in $acl.Access) {
        $result += [PSCustomObject]@{
            Identity = [string]$access.IdentityReference
            Rights   = [string]$access.FileSystemRights
            Type     = [string]$access.AccessControlType
        }
    }
}
ConvertTo-Json $result
`;
    const stdout = await runPS1(script);
    if (!stdout.trim() || stdout.trim() === 'null') return [];
    let data;
    try { data = JSON.parse(stdout.trim()); } catch { return []; }
    if (!Array.isArray(data)) data = [data];

    const perms = data.map((p, i) => {
      const rights = (p.Rights || '').toLowerCase();
      const canRead  = rights.includes('read') || rights.includes('fullcontrol');
      const canWrite = rights.includes('write') || rights.includes('modify') || rights.includes('fullcontrol');
      let targetName = p.Identity || '';
      if (targetName.includes('\\')) targetName = targetName.split('\\')[1];
      return {
        id: `perm_${i}`,
        path: folderPath,
        type: 'user',
        targetId: `tgt_${i}`,
        targetName,
        read: canRead,
        write: canWrite,
        rawRights: p.Rights,
        createdAt: new Date().toISOString()
      };
    });
    setCache(key, perms);
    return perms;
  }
}

module.exports = WindowsRPC;
