const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3050;
const SYNC_TOKEN = process.env.SYNC_TOKEN || 'dc_manager_secret_token';

app.use(cors());
app.use(express.json());

// Token validation middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers['x-sync-token'] || req.query.token;
  if (token !== SYNC_TOKEN) {
    return res.status(401).json({ error: 'Nao autorizado. Token de sincronizacao invalido.' });
  }
  next();
};

// Executa um script PS1 temporario localmente — output decodificado como UTF-8
function runLocalPS1(scriptContent) {
  const tmp = path.join(os.tmpdir(), `dc_agent_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);
  // Forcamos UTF-8 no cabecalho do script para que o ConvertTo-Json use acentos corretos
  const header = '$OutputEncoding = [System.Text.Encoding]::UTF8\n[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n';
  fs.writeFileSync(tmp, '\ufeff' + header + scriptContent, { encoding: 'utf8' }); // BOM + header

  return new Promise((resolve, reject) => {
    const args = [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', tmp
    ];

    const child = execFile('powershell.exe', args, {
      timeout: 1800000,
      maxBuffer: 100 * 1024 * 1024,
      encoding: 'buffer' // Recebe stdout como Buffer bruto
    }, (err, stdoutBuf, stderrBuf) => {
      try { fs.unlinkSync(tmp); } catch (_) {}

      if (err && !stdoutBuf) {
        return reject(err);
      }

      // Decodifica o Buffer como UTF-8 — preserva acentos e caracteres especiais
      const stdout = stdoutBuf ? stdoutBuf.toString('utf8') : '';
      resolve(stdout);
    });
  });
}

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    os: os.platform(),
    hostname: os.hostname(),
    timestamp: new Date().toISOString()
  });
});

// GET /api/extract
app.get('/api/extract', authMiddleware, async (req, res) => {
  let rootPath = req.query.rootPath || 'C:\\';
  // Normalize Windows Path
  rootPath = path.resolve(rootPath).replace(/\//g, '\\');
  if (!rootPath.endsWith('\\') && rootPath.length === 2) {
    rootPath += '\\'; // C: -> C:\
  }

  console.log(`[${new Date().toISOString()}] Iniciando extracao. Caminho raiz: ${rootPath}`);

  try {
    // 1. Script para buscar Usuarios (AD / NTDS ou Local)
    const usersScript = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @()
try {
    # Tenta usar o ADSISearcher para pesquisar no Active Directory (NTDS)
    $searcher = [ADSISearcher]'(objectClass=user)'
    $searcher.PageSize = 1000
    $users = $searcher.FindAll()
    foreach ($u in $users) {
        $props = $u.Properties
        $sam = [string]$props.samaccountname
        $name = [string]$props.displayname
        if (-not $name) { $name = [string]$props.name }
        $mail = [string]$props.mail
        if ($sam -and -not $sam.EndsWith('$')) {
            $result += [PSCustomObject]@{
                Name = $name
                Username = $sam
                Email = $mail
            }
        }
    }
} catch {
    # Fallback para local SAM se nao estiver em Dominio/AD
    $adsi = [ADSI]"WinNT://$env:COMPUTERNAME"
    $users = $adsi.Children | Where-Object { $_.SchemaClassName -eq 'User' }
    foreach ($u in $users) {
        $result += [PSCustomObject]@{
            Name = [string]$u.Name
            Username = [string]$u.Name
            Email = ""
        }
    }
}
ConvertTo-Json $result
`;

    // 2. Script para buscar Grupos e seus membros
    const groupsScript = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @()
try {
    $searcher = [ADSISearcher]'(objectClass=group)'
    $searcher.PageSize = 1000
    $groups = $searcher.FindAll()
    foreach ($g in $groups) {
        $de = $g.GetDirectoryEntry()
        $members = @()
        try {
            foreach ($m in $de.Members()) {
                $mProps = $m.Properties
                $mSam = [string]$m.sAMAccountName
                if (-not $mSam) { $mSam = [string]$m.Name }
                if ($mSam) { $members += $mSam }
            }
        } catch {}
        $result += [PSCustomObject]@{
            Name = [string]$de.sAMAccountName
            Description = [string]$de.description
            Members = $members -join ','
        }
    }
} catch {
    $adsi = [ADSI]"WinNT://$env:COMPUTERNAME"
    $localGroups = $adsi.Children | Where-Object { $_.SchemaClassName -eq 'Group' }
    foreach ($g in $localGroups) {
        $members = @()
        try {
            $groupObj = [ADSI]$g.Path
            foreach ($m in @($groupObj.Invoke('Members'))) {
                $mEntry = [ADSI]$m
                $members += [string]$mEntry.Name
            }
        } catch {}
        $result += [PSCustomObject]@{
            Name = [string]$g.Name
            Description = 'Grupo local'
            Members = $members -join ','
        }
    }
}
ConvertTo-Json $result
`;

    // 3. Script para buscar Pastas e Permissoes (ACLs) recursivamente ate profundidade 3
    const foldersScript = `
$ErrorActionPreference = 'SilentlyContinue'
$root = "${rootPath.replace(/\\/g, '\\\\')}"
$maxDepth = 3

function Get-Tree($p, $rel, $depth) {
    if ($depth -gt $maxDepth) { return @() }
    $result = @()
    $dirs = Get-ChildItem -LiteralPath $p -Directory -ErrorAction SilentlyContinue
    foreach ($d in $dirs) {
        $childRel = if ($rel -eq "/") { "/$($d.Name)" } else { "$rel/$($d.Name)" }
        $parentRel = $rel
        
        $acls = @()
        $acl = Get-Acl -LiteralPath $d.FullName -ErrorAction SilentlyContinue
        if ($acl) {
            foreach ($access in $acl.Access) {
                $acls += [PSCustomObject]@{
                    Identity = [string]$access.IdentityReference
                    Rights   = [string]$access.FileSystemRights
                    Type     = [string]$access.AccessControlType
                }
            }
        }

        $result += [PSCustomObject]@{
            Name = $d.Name
            Path = $childRel
            ParentPath = $parentRel
            Permissions = $acls
        }

        $result += Get-Tree $d.FullName $childRel ($depth + 1)
    }
    return $result
}

# ACL da pasta raiz
$rootAcls = @()
$rootAcl = Get-Acl -LiteralPath $root -ErrorAction SilentlyContinue
if ($rootAcl) {
    foreach ($access in $rootAcl.Access) {
        $rootAcls += [PSCustomObject]@{
            Identity = [string]$access.IdentityReference
            Rights   = [string]$access.FileSystemRights
            Type     = [string]$access.AccessControlType
        }
    }
}
$rootName = Split-Path $root -Leaf
if (-not $rootName) { $rootName = $root }
$rootObj = [PSCustomObject]@{
    Name = $rootName
    Path = "/"
    ParentPath = ""
    Permissions = $rootAcls
}

$folders = @($rootObj) + @(Get-Tree $root "/" 1)
ConvertTo-Json $folders -Depth 5
`;

    // Executa as operacoes em paralelo localmente no servidor
    const [usersOut, foldersOut] = await Promise.all([
      runLocalPS1(usersScript),
      runLocalPS1(foldersScript)
    ]);

    // Parse dos resultados JSON
    let users = [];
    let groups = [];
    let folders = [];

    try {
      if (usersOut && usersOut.trim() !== 'null') {
        users = JSON.parse(usersOut.trim());
        if (!Array.isArray(users)) users = [users];
      }
    } catch (e) { console.error('Erro parse users:', e); }

    try {
      if (foldersOut && foldersOut.trim() !== 'null') {
        folders = JSON.parse(foldersOut.trim());
        if (!Array.isArray(folders)) folders = [folders];
      }
    } catch (e) { console.error('Erro parse folders:', e); }

    console.log(`[${new Date().toISOString()}] Extracao concluida. Encontrados: ${users.length} users, ${groups.length} groups, ${folders.length} folders.`);

    res.json({
      users,
      groups,
      folders
    });

  } catch (err) {
    console.error('Erro ao extrair informacoes:', err);
    res.status(500).json({ error: 'Erro ao extrair informacoes do servidor local: ' + err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('===================================================');
  console.log(`📶 DC Manager Agent rodando em http://0.0.0.0:${PORT}`);
  console.log(`🔑 Token de Sincronizacao: ${SYNC_TOKEN}`);
  console.log('===================================================');
});
