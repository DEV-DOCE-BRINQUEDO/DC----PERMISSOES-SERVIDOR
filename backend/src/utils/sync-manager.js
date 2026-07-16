const cron = require('node-cron');
const db = require('./db');

/**
 * Realiza a sincronizacao de um servidor especifico.
 * Conecta ao agente do servidor, extrai os dados, e insere no SQLite em uma transacao.
 */
async function syncServer(serverId) {
  const server = await db.get('SELECT * FROM servers WHERE id = ?', [serverId]);
  if (!server) throw new Error('Servidor nao encontrado');

  console.log(`[Sync] Iniciando sincronizacao para: ${server.name} (${server.ip})`);
  
  // Atualiza status para 'syncing'
  await db.run(
    'UPDATE servers SET syncStatus = ?, syncError = ?, updatedAt = ? WHERE id = ?',
    ['syncing', null, new Date().toISOString(), serverId]
  );

  try {
    const url = `http://${server.ip}:${server.agentPort || 3001}/api/extract?rootPath=${encodeURIComponent(server.rootPath || 'C:\\')}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800000); // 30 minutos de timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-sync-token': server.token || 'dc_manager_secret_token',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    const { users = [], groups = [], folders = [] } = data;

    // --- SALVA NO BANCO DE DADOS EM TRANSACAO ---
    await db.run('BEGIN TRANSACTION');

    try {
      // 1. Limpa os dados antigos do servidor
      await db.run('DELETE FROM users WHERE serverId = ?', [serverId]);
      await db.run('DELETE FROM groups WHERE serverId = ?', [serverId]);
      await db.run('DELETE FROM folders WHERE serverId = ?', [serverId]);
      await db.run('DELETE FROM permissions WHERE serverId = ?', [serverId]);

      const ignoreList = [
        'system', 'administrators', 'administradores', 'users', 'usuarios', 'guests', 'convidados', 
        'creator owner', 'proprietario criador', 'creator group', 'grupo criador', 
        'everyone', 'todos', 'iis_iusrs', 'network service', 'servico de rede', 
        'local service', 'servico local', 'authenticated users', 'usuarios autenticados',
        'interactive', 'interativo', 'network', 'rede', 'service', 'servico', 
        'anonymous logon', 'logon anonimo', 'trustedinstaller', 'defaultaccount', 'guest', 'convidado',
        'wdiadmin', 'fontdrvhost', 'dwm', 'umfd', 'nt service', 'apppool'
      ];
      
      const isIgnored = (name) => {
        if (!name) return true;
        let n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (n.includes('\\')) n = n.split('\\')[1];
        if (ignoreList.includes(n)) return true;
        if (n.startsWith('nt authority') || n.startsWith('builtin') || n.startsWith('window manager') || n.startsWith('nt service')) return true;
        return false;
      };

      // 2. Insere Grupos
      const insertedGroupIds = new Set();
      for (const g of groups) {
        if (isIgnored(g.Name)) continue; // Pula grupos padroes
        const id = `grp_${serverId}_${g.Name.toLowerCase()}`;
        insertedGroupIds.add(id);
        await db.run(
          'INSERT INTO groups (id, name, description, serverId) VALUES (?, ?, ?, ?)',
          [id, g.Name, g.Description || 'Grupo importado', serverId]
        );
      }

      // 3. Mapeamento de Usuario -> Grupos (com base no campo Members retornado dos grupos)
      const userGroupsMap = {};
      for (const g of groups) {
        if (g.Members) {
          const membersList = g.Members.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
          const groupId = `grp_${serverId}_${g.Name.toLowerCase()}`;
          for (const username of membersList) {
            if (!userGroupsMap[username]) {
              userGroupsMap[username] = [];
            }
            userGroupsMap[username].push(groupId);
          }
        }
      }

      // 4. Insere Usuarios
      const insertedUsernames = new Set();
      for (const u of users) {
        if (isIgnored(u.Username)) continue; // Pula usuarios padroes
        const id = `usr_${serverId}_${u.Username.toLowerCase()}`;
        insertedUsernames.add(u.Username.toLowerCase());
        const userGroups = userGroupsMap[u.Username.toLowerCase()] || [];

        await db.run(
          'INSERT INTO users (id, username, name, email, role, status, groups_json, serverId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            u.Username,
            u.Name || u.Username,
            u.Email || '',
            'user',
            'active',
            JSON.stringify(userGroups),
            serverId
          ]
        );
      }

      // 5. Insere Pastas e Permissoes
      for (const f of folders) {
        const fPath = f.Path !== undefined && f.Path !== null ? f.Path : '/';
        const fParentPath = f.ParentPath !== undefined && f.ParentPath !== null ? f.ParentPath : '';
        const pathSafe = Buffer.from(fPath).toString('base64').replace(/[+=/]/g, '');
        const folderId = `fld_${serverId}_${pathSafe}`;

        await db.run(
          'INSERT INTO folders (id, name, path, parentPath, serverId) VALUES (?, ?, ?, ?, ?)',
          [folderId, f.Name, fPath, fParentPath, serverId]
        );

        // Insere as permissoes da pasta
        if (f.Permissions && Array.isArray(f.Permissions)) {
          let pIndex = 0;
          for (const p of f.Permissions) {
            let identityName = p.Identity || '';
            if (identityName.includes('\\')) {
              identityName = identityName.split('\\')[1];
            }

            if (isIgnored(identityName)) continue; // Ignora usuario padrao do windows

            // Resolve targetId e targetType (user ou group)
            let targetType = 'user';
            let targetId = `usr_${serverId}_${identityName.toLowerCase()}`;

            const checkGroupId = `grp_${serverId}_${identityName.toLowerCase()}`;
            if (insertedGroupIds.has(checkGroupId)) {
              targetType = 'group';
              targetId = checkGroupId;
            } else if (!insertedUsernames.has(identityName.toLowerCase())) {
              // Se nao for um usuario explicitamente importado nem um grupo, CRIA DINAMICAMENTE
              // Isso garante que usuarios de dominio aparecam na tela de Usuarios mesmo se nao vieram no script base
              targetType = 'user';
              targetId = `usr_${serverId}_${identityName.toLowerCase()}`;
              insertedUsernames.add(identityName.toLowerCase());
              
              await db.run(
                'INSERT INTO users (id, username, name, email, role, status, groups_json, serverId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                  targetId,
                  identityName,
                  identityName,
                  '',
                  'user',
                  'active',
                  '[]',
                  serverId
                ]
              );
            }

            // Calcula direitos de Leitura/Escrita
            const rights = (p.Rights || '').toLowerCase();
            const canRead = (rights.includes('read') || rights.includes('fullcontrol')) ? 1 : 0;
            const canWrite = (rights.includes('write') || rights.includes('modify') || rights.includes('fullcontrol')) ? 1 : 0;

            const permId = `perm_${serverId}_${pathSafe}_${pIndex++}`;

            await db.run(
              'INSERT INTO permissions (id, path, type, targetId, targetName, read, write, rawRights, serverId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                permId,
                fPath,
                targetType,
                targetId,
                identityName,
                canRead,
                canWrite,
                p.Rights || '',
                serverId
              ]
            );
          }
        }
      }

      await db.run('COMMIT');

      // Atualiza status do servidor para 'success'
      await db.run(
        'UPDATE servers SET syncStatus = ?, syncError = ?, lastSyncedAt = ?, updatedAt = ? WHERE id = ?',
        ['success', null, new Date().toISOString(), new Date().toISOString(), serverId]
      );
      console.log(`[Sync] Servidor sincronizado com sucesso: ${server.name}`);

    } catch (dbErr) {
      await db.run('ROLLBACK');
      throw dbErr;
    }

  } catch (err) {
    console.error(`[Sync] Erro ao sincronizar servidor ${server.name}:`, err);
    await db.run(
      'UPDATE servers SET syncStatus = ?, syncError = ?, updatedAt = ? WHERE id = ?',
      ['failed', err.message, new Date().toISOString(), serverId]
    );
  }
}

/**
 * Sincroniza todos os servidores cadastrados
 */
async function syncAllServers() {
  console.log('[Sync Schedule] Iniciando sincronizacao automatica de todos os servidores...');
  try {
    const servers = await db.all('SELECT id FROM servers');
    for (const s of servers) {
      try {
        await syncServer(s.id);
      } catch (err) {
        console.error(`[Sync Schedule] Falha ao sincronizar servidor ID ${s.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Sync Schedule] Erro ao buscar lista de servidores:', err.message);
  }
}

/**
 * Inicializa a cron job
 */
function initScheduler() {
  // Agenda a tarefa para rodar todos os dias as 23:59
  cron.schedule('59 23 * * *', () => {
    syncAllServers();
  });
  console.log('[Sync Scheduler] Cron job configurado para rodar diariamente as 23:59.');
}

module.exports = {
  syncServer,
  syncAllServers,
  initScheduler
};
