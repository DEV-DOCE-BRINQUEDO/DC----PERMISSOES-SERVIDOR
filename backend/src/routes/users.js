const express = require('express');
const router = express.Router();
const db = require('../utils/db');

// GET /api/users — Listar usuarios
router.get('/', async (req, res) => {
  const { serverId } = req.query;

  try {
    let users;
    if (serverId) {
      users = await db.all('SELECT * FROM users WHERE serverId = ? ORDER BY name ASC', [serverId]);
    } else {
      users = await db.all('SELECT * FROM users ORDER BY name ASC');
    }

    // Mapeia o groups_json de volta para array
    const mappedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role || 'user',
      status: u.status || 'active',
      groups: JSON.parse(u.groups_json || '[]'),
      serverId: u.serverId,
      createdAt: new Date().toISOString() // Data dummy de visualizacao
    }));

    res.json(mappedUsers);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuarios no banco: ' + err.message });
  }
});

// GET /api/users/:id — Buscar usuario unico
router.get('/:id', async (req, res) => {
  try {
    const u = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!u) return res.status(404).json({ error: 'Usuario nao encontrado' });
    
    res.json({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role || 'user',
      status: u.status || 'active',
      groups: JSON.parse(u.groups_json || '[]'),
      serverId: u.serverId
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuario: ' + err.message });
  }
});

// GET /api/users/:id/permissions — Buscar permissões diretas e indiretas (via grupo) do usuário
router.get('/:id/permissions', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Buscar grupos do usuario
    const user = await db.get('SELECT groups_json FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
    
    const groups = JSON.parse(user.groups_json || '[]');
    
    // Monta a query para buscar permissoes onde targetId é o proprio user OU um dos grupos
    const placeholders = groups.map(() => '?').join(',');
    let query = 'SELECT p.*, f.name as folderName FROM permissions p JOIN folders f ON p.path = f.path AND p.serverId = f.serverId WHERE p.targetId = ?';
    const params = [userId];
    
    if (groups.length > 0) {
      query += ` OR p.targetId IN (${placeholders})`;
      params.push(...groups);
    }
    
    const permissions = await db.all(query, params);
    res.json(permissions);
    
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar permissoes do usuario: ' + err.message });
  }
});

module.exports = router;
