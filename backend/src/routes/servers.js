const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const syncManager = require('../utils/sync-manager');

// Test connection helper
async function testAgentConnection(ip, port, token) {
  const url = `http://${ip}:${port || 3001}/api/health?token=${token}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 segundos de timeout para teste rapido

    const res = await fetch(url, {
      headers: { 'x-sync-token': token },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Token invalido ou erro no agente (HTTP ${res.status})`);
    }
    return true;
  } catch (err) {
    throw new Error(`Nao foi possivel conectar ao Agente em ${ip}:${port || 3001}. Verifique se o agente esta rodando, se a porta esta aberta no firewall e se o token esta correto. Detalhes: ${err.message}`);
  }
}

// GET /api/servers
router.get('/', async (req, res) => {
  try {
    const servers = await db.all('SELECT * FROM servers ORDER BY name ASC');
    const safeServers = servers.map(s => ({
      ...s,
      token: s.token ? '••••••••' : undefined
    }));
    res.json(safeServers);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar servidores: ' + err.message });
  }
});

// GET /api/servers/:id
router.get('/:id', async (req, res) => {
  try {
    const s = await db.get('SELECT * FROM servers WHERE id = ?', [req.params.id]);
    if (!s) return res.status(404).json({ error: 'Servidor nao encontrado' });
    res.json({ ...s, token: s.token ? '••••••••' : undefined });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar servidor: ' + err.message });
  }
});

// POST /api/servers — Criar servidor (testa conexao antes de salvar)
router.post('/', async (req, res) => {
  const { name, ip, agentPort, token, rootPath } = req.body;
  if (!name || !ip) {
    return res.status(400).json({ error: 'Nome e IP/Hostname sao obrigatorios' });
  }

  const port = agentPort || 3001;
  const tk = token || 'dc_manager_secret_token';
  const rp = rootPath || 'C:\\';

  try {
    // 1. Verifica se IP ja cadastrado
    const existing = await db.get('SELECT id FROM servers WHERE ip = ?', [ip]);
    if (existing) {
      return res.status(409).json({ error: 'Este IP/Hostname ja esta cadastrado' });
    }

    // 2. Testa a conexao com o agente
    console.log(`[Servers API] Testando conexao com agente em http://${ip}:${port}...`);
    await testAgentConnection(ip, port, tk);

    // 3. Salva no banco de dados
    const newServer = {
      id: uuidv4(),
      name, ip,
      agentPort: port,
      token: tk,
      rootPath: rp,
      syncStatus: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.run(`
      INSERT INTO servers (id, name, ip, agentPort, token, rootPath, syncStatus, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newServer.id, newServer.name, newServer.ip, newServer.agentPort,
      newServer.token, newServer.rootPath, newServer.syncStatus,
      newServer.createdAt, newServer.updatedAt
    ]);

    // Dispara a primeira sincronizacao em segundo plano
    syncManager.syncServer(newServer.id).catch(console.error);

    res.status(201).json({ ...newServer, token: '••••••••' });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/servers/:id — Editar servidor (testa conexao se alterar rede)
router.put('/:id', async (req, res) => {
  try {
    const old = await db.get('SELECT * FROM servers WHERE id = ?', [req.params.id]);
    if (!old) return res.status(404).json({ error: 'Servidor nao encontrado' });

    const { name, ip, agentPort, token, rootPath } = req.body;
    
    const newIp = ip ?? old.ip;
    const newPort = agentPort ?? old.agentPort;
    const newToken = (token && token !== '••••••••') ? token : old.token;
    const newRootPath = rootPath ?? old.rootPath;

    // Se houve alteracao nos dados de conexao, testa novamente
    if (newIp !== old.ip || newPort !== old.agentPort || (token && token !== '••••••••')) {
      console.log(`[Servers API] Credenciais alteradas. Testando conexao com http://${newIp}:${newPort}...`);
      await testAgentConnection(newIp, newPort, newToken);
    }

    await db.run(`
      UPDATE servers 
      SET name = ?, ip = ?, agentPort = ?, token = ?, rootPath = ?, updatedAt = ?
      WHERE id = ?
    `, [
      name ?? old.name,
      newIp,
      newPort,
      newToken,
      newRootPath,
      new Date().toISOString(),
      req.params.id
    ]);

    const updated = await db.get('SELECT * FROM servers WHERE id = ?', [req.params.id]);
    res.json({ ...updated, token: '••••••••' });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/servers/:id — Remover servidor e limpar tabelas vinculadas
router.delete('/:id', async (req, res) => {
  try {
    const s = await db.get('SELECT id FROM servers WHERE id = ?', [req.params.id]);
    if (!s) return res.status(404).json({ error: 'Servidor nao encontrado' });

    // Exclui em cascata manualmente para garantir consistência
    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('DELETE FROM users WHERE serverId = ?', [req.params.id]);
      await db.run('DELETE FROM groups WHERE serverId = ?', [req.params.id]);
      await db.run('DELETE FROM folders WHERE serverId = ?', [req.params.id]);
      await db.run('DELETE FROM permissions WHERE serverId = ?', [req.params.id]);
      await db.run('DELETE FROM servers WHERE id = ?', [req.params.id]);
      await db.run('COMMIT');
    } catch (txErr) {
      await db.run('ROLLBACK');
      throw txErr;
    }

    res.json({ message: 'Servidor e todos os seus dados sincronizados foram removidos' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover servidor: ' + err.message });
  }
});

// POST /api/servers/:id/sync — Dispara sincronizacao em background (retorno imediato 202)
router.post('/:id/sync', async (req, res) => {
  try {
    const server = await db.get('SELECT id FROM servers WHERE id = ?', [req.params.id]);
    if (!server) return res.status(404).json({ error: 'Servidor nao encontrado' });

    // Responde imediatamente — o sync roda em background
    res.status(202).json({ message: 'Sincronizacao iniciada em background' });

    // Executa sem await para nao bloquear a resposta HTTP
    syncManager.syncServer(req.params.id).catch(err => {
      console.error('[Sync] Erro no background sync:', err.message);
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao iniciar sincronizacao: ' + err.message });
  }
});

module.exports = router;
