// backend/middlewares/auth.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    console.log("Nenhum token JWT fornecido na requisição.");
    return next(); // Permitir acesso anônimo (como no server.js original)
  }

  jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_aqui', (err, user) => {
    if (err) {
      console.warn('Tentativa de acesso com token inválido:', err.message);
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    req.user = user;
    console.log("Token verificado. User:", user);
    next();
  });
};

module.exports = { authenticateToken };