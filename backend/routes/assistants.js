// backend/routes/assistants.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// Endpoint para Master Criar um Assistente
router.post('/assistants', authenticateToken, async (req, res) => {
  const masterUser = req.user;
  if (!masterUser || masterUser.role !== 'master') {
    console.warn(`Tentativa não autorizada de criar assistente por user_id: ${masterUser?.user_id} com role: ${masterUser?.role}`);
    return res.status(403).json({ error: "Apenas usuários 'master' podem criar assistentes." });
  }

  const { username: assistantUsername, password: assistantPassword } = req.body;

  if (!assistantUsername || !assistantPassword) {
    return res.status(400).json({ error: 'Nome de usuário e senha do assistente são obrigatórios.' });
  }
  if (assistantPassword.length < 6) {
    return res.status(400).json({ error: 'Senha do assistente deve ter pelo menos 6 caracteres.' });
  }

  try {
    const existingUser = db.prepare('SELECT user_id FROM users WHERE username = ?').get(assistantUsername);
    if (existingUser) {
      console.log(`Tentativa de criar assistente falhou: usuário ${assistantUsername} já existe.`);
      return res.status(409).json({ error: 'Nome de usuário já está em uso.' });
    }

    const hashedPassword = await bcrypt.hash(assistantPassword, 10);
    const assistantUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const stmt = db.prepare(`
      INSERT INTO users (user_id, username, password, role, master_user_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(assistantUserId, assistantUsername, hashedPassword, 'auxiliar', masterUser.user_id);

    console.log(`Assistente criado: ${assistantUsername} (ID: ${assistantUserId}) pelo Master: ${masterUser.username} (ID: ${masterUser.user_id})`);

    res.status(201).json({
      success: true,
      message: 'Assistente criado com sucesso.',
      assistant: {
        user_id: assistantUserId,
        username: assistantUsername,
        role: 'auxiliar',
        master_user_id: masterUser.user_id
      }
    });
  } catch (err) {
    console.error(`Erro interno ao criar assistente pelo Master ${masterUser.user_id}:`, err);
    res.status(500).json({ error: 'Erro interno ao criar assistente.' });
  }
});

// Endpoint para Master Listar seus Assistentes
router.get('/assistants', authenticateToken, (req, res) => {
  const masterUser = req.user;
  if (!masterUser || masterUser.role !== 'master') {
    console.warn(`Tentativa não autorizada de listar assistentes por user_id: ${masterUser?.user_id} com role: ${masterUser?.role}`);
    return res.status(403).json({ error: "Apenas usuários 'master' podem listar assistentes." });
  }

  const masterUserId = masterUser.user_id;
  console.log(`Buscando lista de assistentes para Master ID: ${masterUserId}`);

  try {
    const assistants = db.prepare(`
      SELECT user_id, username, role, master_user_id, created_at
      FROM users
      WHERE role = 'auxiliar' AND master_user_id = ?
      ORDER BY created_at DESC
    `).all(masterUserId);

    console.log(`Encontrados ${assistants.length} assistentes para Master ID: ${masterUserId}`);

    res.json({ assistants: assistants || [] });
  } catch (dbError) {
    console.error(`Erro de banco de dados ao listar assistentes para Master ID ${masterUserId}:`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar assistentes.' });
  }
});

module.exports = router;