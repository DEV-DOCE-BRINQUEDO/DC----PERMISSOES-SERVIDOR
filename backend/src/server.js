const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { authMiddleware, AUTH_ENABLED } = require('./middleware/auth');

const usersRouter = require('./routes/users');
const groupsRouter = require('./routes/groups');
const foldersRouter = require('./routes/folders');
const serversRouter = require('./routes/servers');

const app = express();
const PORT = process.env.PORT || 3010;

// CORS — permite qualquer origem (ideal para uso em rede local/intranet)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));
app.options('*', cors()); // pré-voo OPTIONS para todas as rotas
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check (sem auth)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    authEnabled: AUTH_ENABLED,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Auth proxy (valida token via authMiddleware e retorna usuário)
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

// Rotas protegidas (auth middleware aplicado - bypass se AUTH_ENABLED=false)
app.use('/api/users', authMiddleware, usersRouter);
app.use('/api/groups', authMiddleware, groupsRouter);
app.use('/api/folders', authMiddleware, foldersRouter);
app.use('/api/servers', authMiddleware, serversRouter);

// Serve o frontend buildado se a pasta dist existir
const frontendBuildPath = path.join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser');
const frontendExists = fs.existsSync(frontendBuildPath);
console.log(`🌐 Frontend build: ${frontendExists ? 'ENCONTRADO em' : 'NAO encontrado em'} ${frontendBuildPath}`);
if (frontendExists) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor', message: err.message });
});

const db = require('./utils/db');
const syncManager = require('./utils/sync-manager');

const HOST = process.env.HOST || '0.0.0.0';

db.initDB().then(() => {
  syncManager.initScheduler();

  app.listen(PORT, HOST, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   DC - Gerenciador de Permissões API   ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`🚀 API rodando em http://${HOST}:${PORT}`);
    console.log(`🔐 Autenticação JWT: ${AUTH_ENABLED ? 'ATIVADA' : 'DESATIVADA (bypass mode)'}`);
    console.log(`📁 Banco de dados: SQLite (db.sqlite)`);
    console.log('');
  });
}).catch(err => {
  console.error('Falha ao iniciar o banco de dados:', err);
  process.exit(1);
});

module.exports = app;
