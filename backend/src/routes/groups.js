const express = require('express');
const router = express.Router();
const db = require('../utils/db');

// GET /api/groups — Listar grupos
router.get('/', async (req, res) => {
  const { serverId } = req.query;
  try {
    let groups;
    if (serverId) {
      groups = await db.all('SELECT * FROM groups WHERE serverId = ? ORDER BY name ASC', [serverId]);
    } else {
      groups = await db.all('SELECT * FROM groups ORDER BY name ASC');
    }

    const mappedGroups = groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description || '',
      serverId: g.serverId,
      createdAt: new Date().toISOString()
    }));
    
    res.json(mappedGroups);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar grupos: ' + err.message });
  }
});

// GET /api/groups/:id — Detalhe do grupo e seus membros
router.get('/:id', async (req, res) => {
  try {
    const g = await db.get('SELECT * FROM groups WHERE id = ?', [req.params.id]);
    if (!g) return res.status(404).json({ error: 'Grupo nao encontrado' });

    // Busca usuarios que pertencem a este grupo analisando o groups_json de cada usuario
    const allUsers = await db.all('SELECT * FROM users WHERE serverId = ?', [g.serverId]);
    const members = allUsers.filter(u => {
      const gIds = JSON.parse(u.groups_json || '[]');
      return gIds.includes(g.id);
    }).map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email
    }));

    res.json({
      id: g.id,
      name: g.name,
      description: g.description,
      serverId: g.serverId,
      membersData: members,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar detalhe do grupo: ' + err.message });
  }
});

module.exports = router;
