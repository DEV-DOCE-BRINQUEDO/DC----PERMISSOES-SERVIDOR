/**
 * Auth Middleware
 * JWT authentication middleware - CURRENTLY DISABLED (bypass mode)
 * To enable: set AUTH_ENABLED=true in environment variables
 * 
 * When integrating with portal:
 * 1. Set AUTH_ENABLED=true
 * 2. Set JWT_SECRET to the same secret used by the portal
 * 3. The portal should send the token in header: Authorization: Bearer <token>
 */

const AUTH_ENABLED = true; // Ativado para a integracao com portal

const tokenCache = new Map(); // token -> { user, exp }

const authMiddleware = async (req, res, next) => {
  // Bypass opcional via variavel de ambiente (para fallback)
  if (process.env.AUTH_BYPASS === 'true') {
    req.user = { id: 'system', role: 'admin', name: 'Sistema' };
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Token de autenticacao nao fornecido',
      code: 'TOKEN_MISSING'
    });
  }

  // Verifica cache
  const cached = tokenCache.get(token);
  if (cached && cached.exp > Date.now()) {
    req.user = cached.user;
    return next();
  }

  try {
    // Valida o token contra o Portal
    const response = await fetch('http://192.168.13.249:7000/api/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Token rejeitado pelo portal');

    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error('Resposta invalida do portal');
    }

    req.user = result.data; // { id, email, roles, permissions }

    // Salva no cache por 5 minutos
    tokenCache.set(token, {
      user: req.user,
      exp: Date.now() + 5 * 60 * 1000
    });

    // Previne vazamento de memoria se o cache crescer muito
    if (tokenCache.size > 1000) tokenCache.clear();

    next();
  } catch (err) {
    return res.status(403).json({ 
      error: 'Token invalido ou expirado',
      code: 'TOKEN_INVALID'
    });
  }
};

module.exports = { authMiddleware, AUTH_ENABLED };
