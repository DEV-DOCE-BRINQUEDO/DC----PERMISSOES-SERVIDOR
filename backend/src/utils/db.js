const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Async query wrappers
const run = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const all = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const get = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize SQLite Schema
async function initDB() {
  await run(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      agentPort INTEGER DEFAULT 3001,
      token TEXT DEFAULT 'dc_manager_secret_token',
      rootPath TEXT,
      syncStatus TEXT DEFAULT 'idle',
      syncError TEXT,
      lastSyncedAt TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      groups_json TEXT DEFAULT '[]',
      serverId TEXT NOT NULL,
      FOREIGN KEY (serverId) REFERENCES servers (id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      serverId TEXT NOT NULL,
      FOREIGN KEY (serverId) REFERENCES servers (id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      parentPath TEXT NOT NULL,
      serverId TEXT NOT NULL,
      FOREIGN KEY (serverId) REFERENCES servers (id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      type TEXT NOT NULL,
      targetId TEXT NOT NULL,
      targetName TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      write INTEGER DEFAULT 0,
      rawRights TEXT,
      serverId TEXT NOT NULL,
      FOREIGN KEY (serverId) REFERENCES servers (id) ON DELETE CASCADE
    )
  `);

  // Migrate servers from old db.json if database is empty
  try {
    const existingServers = await all('SELECT id FROM servers');
    if (existingServers.length === 0) {
      const jsonDBPath = path.join(dbDir, 'db.json');
      if (fs.existsSync(jsonDBPath)) {
        console.log('[SQLite DB] db.json encontrado. Migrando servidores...');
        const raw = fs.readFileSync(jsonDBPath, 'utf8');
        const data = JSON.parse(raw);
        if (data.servers && Array.isArray(data.servers)) {
          for (const s of data.servers) {
            await run(`
              INSERT INTO servers (id, name, ip, agentPort, token, rootPath, syncStatus, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              s.id,
              s.name,
              s.ip,
              3001, // default agentPort
              'dc_manager_secret_token', // default security token
              s.rootPath || '',
              'idle',
              s.createdAt || new Date().toISOString(),
              s.updatedAt || new Date().toISOString()
            ]);
            console.log(`[SQLite DB] Servidor migrado: ${s.name} (${s.ip})`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[SQLite DB] Erro durante a migracao do db.json:', err);
  }
}

module.exports = {
  run,
  all,
  get,
  initDB,
  db
};
