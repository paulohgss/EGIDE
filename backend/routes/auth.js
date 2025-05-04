// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// POST /api/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const existingUser = db.prepare('SELECT user_id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      console.log(`Tentativa de registro falhou: usuário ${username} já existe.`);
      return res.status(409).json({ error: 'Nome de usuário já está em uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user_id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const stmt = db.prepare('INSERT INTO users (user_id, username, password) VALUES (?, ?, ?)');
    stmt.run(user_id, username, hashedPassword);

    console.log(`Usuário registrado: ${username} (ID: ${user_id})`);
    res.status(201).json({ success: true, user_id });
  } catch (err) {
    console.error('Erro interno ao registrar usuário:', err);
    res.status(500).json({ error: 'Erro interno ao registrar usuário.' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
  }

  try {
    const row = db.prepare('SELECT user_id, username, password, role FROM users WHERE username = ?').get(username);
    if (!row) {
      console.log(`Tentativa de login falhou para usuário inexistente: ${username}`);
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const match = await bcrypt.compare(password, row.password);
    if (!match) {
      console.log(`Tentativa de login falhou para usuário ${username}: senha incorreta.`);
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const tokenPayload = {
      user_id: row.user_id,
      username: row.username,
      role: row.role
    };
    // Verificar se JWT_SECRET está definida
    if (!process.env.JWT_SECRET) {
      console.error("FATAL: JWT_SECRET não definida no ambiente.");
      return res.status(500).json({ error: "Erro de configuração do servidor." });
    }
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log(`Login bem-sucedido para usuário: ${username} (Role: ${row.role})`);
    res.json({ token, user_id: row.user_id, username: row.username, role: row.role });
  } catch (err) {
    console.error('Erro interno ao fazer login:', err);
    res.status(500).json({ error: 'Erro interno ao fazer login.' });
  }
});

module.exports = router;