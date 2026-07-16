const express = require('express');
const router = express.Router();
const db = require('../utils/db');

// Helper to build recursive tree
const buildTree = (fldrs, pPath = '/') => {
  return fldrs
    .filter(f => f.parentPath === pPath)
    .map(folder => ({
      ...folder,
      children: buildTree(fldrs, folder.path)
    }));
};

// GET /api/folders — Listar pastas em arvore ou subpastas por parentPath
router.get('/', async (req, res) => {
  const { serverId, parentPath } = req.query;
  if (!serverId) return res.status(400).json({ error: 'serverId e obrigatorio' });

  try {
    if (parentPath) {
      // Lazy load de subpastas
      const folders = await db.all(
        'SELECT * FROM folders WHERE serverId = ? AND parentPath = ? ORDER BY name ASC',
        [serverId, parentPath]
      );
      return res.json({ folders, tree: folders.map(f => ({ ...f, children: [] })) });
    }

    // Primeira carga: carrega todas as pastas do servidor e monta a arvore
    const folders = await db.all('SELECT * FROM folders WHERE serverId = ? ORDER BY name ASC', [serverId]);
    
    // Encontra a raiz adequada. Normalmente o parentPath da raiz principal eh '/'
    // ou se tiver pasta raiz configurada, pode ser outra. Encontramos o menor parentPath do conjunto.
    let rootParentPath = '';
    if (folders.length > 0) {
      const parentPaths = folders.map(f => f.parentPath);
      // Pega o parentPath mais curto (ex: "")
      rootParentPath = parentPaths.reduce((a, b) => a.length <= b.length ? a : b, parentPaths[0]);
    }

    const tree = buildTree(folders, rootParentPath);
    res.json({ folders, tree });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pastas: ' + err.message });
  }
});

// GET /api/folders/flat — Listar flat
router.get('/flat', async (req, res) => {
  const { serverId } = req.query;
  try {
    let folders;
    if (serverId) {
      folders = await db.all('SELECT * FROM folders WHERE serverId = ? ORDER BY path ASC', [serverId]);
    } else {
      folders = await db.all('SELECT * FROM folders ORDER BY path ASC');
    }
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pastas flat: ' + err.message });
  }
});

// GET /api/folders/permissions — Listar todas as permissoes do servidor
router.get('/permissions', async (req, res) => {
  const { serverId } = req.query;
  try {
    let perms;
    if (serverId) {
      perms = await db.all('SELECT * FROM permissions WHERE serverId = ?', [serverId]);
    } else {
      perms = await db.all('SELECT * FROM permissions');
    }
    
    const mapped = perms.map(p => ({
      ...p,
      read: !!p.read,
      write: !!p.write
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar permissoes: ' + err.message });
  }
});

// GET /api/folders/permissions/by-path — Listar permissoes de uma pasta
router.get('/permissions/by-path', async (req, res) => {
  const { path: folderPath, serverId } = req.query;
  if (!folderPath || !serverId) {
    return res.status(400).json({ error: 'path e serverId sao obrigatorios' });
  }

  try {
    const perms = await db.all(
      'SELECT * FROM permissions WHERE serverId = ? AND path = ?',
      [serverId, folderPath]
    );
    const mapped = perms.map(p => ({
      ...p,
      read: !!p.read,
      write: !!p.write
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar permissoes da pasta: ' + err.message });
  }
});

module.exports = router;
