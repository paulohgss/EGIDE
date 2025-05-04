// backend/routes/clients.js
const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middlewares/auth');
const cpfValidator = require('cpf-cnpj-validator');

const router = express.Router();

// GET /clients
router.get('/clients', authenticateToken, (req, res) => {
  const user = req.user;
  if (!user || !user.user_id) {
    return res.status(401).json({ error: "Autenticação necessária para listar clientes." });
  }
  if (user.role !== 'master') {
    return res.status(403).json({ error: "Apenas usuários 'master' podem listar clientes." });
  }
  console.log(`Buscando lista de clientes para user_id: ${user.user_id} (Role: ${user.role})`);
  try {
    const clients = db.prepare(`
      SELECT client_id, name, cpf, dob, created_at
      FROM clients
      WHERE user_id = ?
      ORDER BY name ASC
    `).all(user.user_id);
    console.log(`Encontrados ${clients.length} clientes para user_id: ${user.user_id}`);
    res.json({ clients: clients || [] });
  } catch (dbError) {
    console.error(`Erro de banco de dados ao listar clientes para user_id ${user.user_id}:`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar clientes.' });
  }
});

// POST /clients
router.post('/clients', authenticateToken, (req, res) => {
  const user = req.user;
  if (!user || !user.user_id) {
    return res.status(401).json({ error: "Autenticação necessária para cadastrar clientes." });
  }
  if (user.role !== 'master') {
    return res.status(403).json({ error: "Apenas usuários 'master' podem cadastrar clientes." });
  }
  console.log(`Usuário ${user.username} (ID: ${user.user_id}, Role: ${user.role}) tentando cadastrar cliente.`);
  const { name, cpf, dob } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Nome do cliente é obrigatório.' });
  }
  const cleanedCpf = cpf ? cpf.replace(/\D/g, '') : null;
  if (cleanedCpf) {
    if (cleanedCpf.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos.' });
    }
    if (cleanedCpf && !cpfValidator.cpf.isValid(cleanedCpf)) { // Use cpfValidator.cpf
      return res.status(400).json({ error: 'CPF inválido.' });
    }
  }
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return res.status(400).json({ error: 'Formato inválido para Data de Nascimento (use AAAA-MM-DD).' });
  }
  console.log(`Tentando cadastrar cliente '${name}' para user_id: ${user.user_id}`);
  try {
    if (cleanedCpf) {
      const existingClient = db.prepare('SELECT client_id, user_id FROM clients WHERE cpf = ?').get(cleanedCpf);
      if (existingClient) {
        console.warn(`CPF ${cleanedCpf} já cadastrado para client_id ${existingClient.client_id} (advogado ${existingClient.user_id})`);
        return res.status(409).json({ error: 'Este CPF já está cadastrado no sistema.' });
      }
    }
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const stmt = db.prepare(`
      INSERT INTO clients (client_id, user_id, name, cpf, dob)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(clientId, user.user_id, name.trim(), cleanedCpf, dob || null);
    console.log(`Cliente cadastrado: ${name} (ID: ${clientId}) para user_id: ${user.user_id}`);
    res.status(201).json({
      success: true,
      message: 'Cliente cadastrado com sucesso!',
      client: {
        client_id: clientId,
        user_id: user.user_id,
        name: name.trim(),
        cpf: cleanedCpf,
        dob: dob || null
      }
    });
  } catch (dbError) {
    if (dbError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.error(`Erro de constraint UNIQUE ao cadastrar cliente (CPF: ${cleanedCpf}):`, dbError.message);
      return res.status(409).json({ error: 'Erro: CPF já existe.' });
    }
    console.error(`Erro de banco de dados ao cadastrar cliente para user_id ${user.user_id}:`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao cadastrar cliente.' });
  }
});

// GET /clients/:clientId/sessions
router.get('/clients/:clientId/sessions', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const user = req.user;

  if (!user || !user.user_id) {
    return res.status(401).json({ error: "Autenticação necessária para listar sessões do cliente." });
  }
  if (user.role !== 'master') {
    return res.status(403).json({ error: "Apenas usuários 'master' podem listar sessões de clientes." });
  }

  console.log(`Buscando sessões para cliente ID: ${clientId}`);

  try {
    // Verificar se o cliente existe e pertence ao usuário autenticado
    const client = db.prepare('SELECT client_id, name FROM clients WHERE client_id = ? AND user_id = ?').get(clientId, user.user_id);
    if (!client) {
      console.log(`Cliente ${clientId} não encontrado ou não pertence ao usuário ${user.user_id}`);
      return res.status(404).json({ error: 'Cliente não encontrado ou acesso negado.' });
    }

    // Buscar todas as sessões associadas ao cliente
    const sessions = db.prepare(`
      SELECT session_id, user_id, client_id, last_updated_at
      FROM sessions
      WHERE client_id = ?
      ORDER BY last_updated_at DESC
    `).all(clientId);

    console.log(`Encontradas ${sessions.length} sessões para cliente ID: ${clientId}`);
    res.json({ sessions: sessions || [] });
  } catch (dbError) {
    console.error(`Erro de banco de dados ao buscar sessões para cliente ${clientId}:`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar sessões do cliente.' });
  }
});

module.exports = router;