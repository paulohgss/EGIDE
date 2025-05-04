const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

const stmt = db.prepare(`
    INSERT INTO attendances (id, client_id, user_id, description, purpose, purpose_detail, created_at, last_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

// POST /api/attendances (cadastrar atendimento)
router.post('/attendances', authenticateToken, (req, res) => {
    const user = req.user;
    if (!user || !user.user_id) {
        console.log("Falha na autenticação: Token ausente ou inválido.");
        return res.status(401).json({ error: "Autenticação necessária para cadastrar atendimentos." });
    }
    if (user.role !== 'master') {
        console.log(`Falha na autorização: Usuário ${user.user_id} tem role ${user.role}, esperado 'master'.`);
        return res.status(403).json({ error: "Apenas usuários 'master' podem cadastrar atendimentos." });
    }
    console.log(`Usuário ${user.username} (ID: ${user.user_id}, Role: ${user.role}) tentando cadastrar atendimento.`);

    const { client_id, description, purpose, purpose_detail } = req.body;
    console.log("Dados recebidos:", { client_id, description, purpose, purpose_detail });

    if (!client_id || typeof client_id !== 'string' || client_id.trim() === '') {
        console.log("Validação falhou: client_id é obrigatório.");
        return res.status(400).json({ error: 'ID do cliente é obrigatório.' });
    }
    if (!description || typeof description !== 'string' || description.trim() === '') {
        console.log("Validação falhou: Descrição do atendimento é obrigatória.");
        return res.status(400).json({ error: 'Descrição do atendimento é obrigatória.' });
    }
    if (!purpose || typeof purpose !== 'string' || purpose.trim() === '') {
        console.log("Validação falhou: Propósito do atendimento é obrigatório.");
        return res.status(400).json({ error: 'Propósito do atendimento é obrigatório.' });
    }
    if (purpose === 'Outro' && (!purpose_detail || typeof purpose_detail !== 'string' || purpose_detail.trim() === '')) {
        console.log("Validação falhou: Detalhes do propósito são obrigatórios para propósito 'Outro'.");
        return res.status(400).json({ error: 'Detalhes do propósito são obrigatórios para propósito "Outro".' });
    }

    try {
        const client = db.prepare('SELECT client_id FROM clients WHERE client_id = ? AND user_id = ?').get(client_id, user.user_id);
        if (!client) {
            console.log(`Cliente ${client_id} não encontrado ou não pertence ao usuário ${user.user_id}`);
            return res.status(404).json({ error: 'Cliente não encontrado ou acesso negado.' });
        }

        console.log(`Tentando cadastrar atendimento para cliente ID: ${client_id}`);
        const attendanceId = `attendance_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        stmt.run(attendanceId, client_id, user.user_id, description.trim(), purpose.trim(), purpose_detail?.trim() || null);
        console.log(`Atendimento cadastrado: ${attendanceId} para cliente ID: ${client_id}`);
        res.status(201).json({
            success: true,
            message: 'Atendimento cadastrado com sucesso!',
            attendance: {
                attendance_id: attendanceId,
                client_id: client_id,
                user_id: user.user_id,
                description: description.trim(),
                purpose: purpose.trim(),
                purpose_detail: purpose_detail?.trim() || null,
                created_at: new Date().toISOString(),
                last_updated_at: new Date().toISOString()
            }
        });
    } catch (dbError) {
        console.error(`Erro de banco de dados ao cadastrar atendimento para cliente ${client_id}:`, dbError.stack);
        return res.status(500).json({ error: 'Erro interno do servidor ao cadastrar atendimento.', details: dbError.message });
    }
});

// GET /clients/:clientId/attendances (listar atendimentos de um cliente)
router.get('/clients/:clientId/attendances', authenticateToken, (req, res) => {
    const { clientId } = req.params;
    const user = req.user;

    if (!user || !user.user_id) {
        console.log("Falha na autenticação: Token ausente ou inválido.");
        return res.status(401).json({ error: "Autenticação necessária para listar atendimentos." });
    }
    if (user.role !== 'master') {
        console.log(`Falha na autorização: Usuário ${user.user_id} tem role ${user.role}, esperado 'master'.`);
        return res.status(403).json({ error: "Apenas usuários 'master' podem listar atendimentos." });
    }

    console.log(`Buscando atendimentos para cliente ID: ${clientId}`);

    try {
        const client = db.prepare('SELECT client_id, name FROM clients WHERE client_id = ? AND user_id = ?').get(clientId, user.user_id);
        if (!client) {
            console.log(`Cliente ${clientId} não encontrado ou não pertence ao usuário ${user.user_id}`);
            return res.status(404).json({ error: 'Cliente não encontrado ou acesso negado.' });
        }

        const attendances = db.prepare(`
            SELECT id AS attendance_id, client_id, user_id, description, purpose, purpose_detail, created_at, last_updated_at
            FROM attendances
            WHERE client_id = ?
            ORDER BY last_updated_at DESC
        `).all(clientId);

        console.log(`Encontrados ${attendances.length} atendimentos para cliente ID: ${clientId}`);
        res.json({ attendances: attendances || [] });
    } catch (dbError) {
        console.error(`Erro de banco de dados ao buscar atendimentos para cliente ${clientId}:`, dbError.stack);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar atendimentos.', details: dbError.message });
    }
});

// GET /attendances/:attendanceId/sessions (listar sessões de um atendimento)
router.get('/attendances/:attendanceId/sessions', authenticateToken, (req, res) => {
    const { attendanceId } = req.params;
    const user = req.user;

    if (!user || !user.user_id) {
        console.log("Falha na autenticação: Token ausente ou inválido.");
        return res.status(401).json({ error: "Autenticação necessária para listar sessões." });
    }
    if (user.role !== 'master') {
        console.log(`Falha na autorização: Usuário ${user.user_id} tem role ${user.role}, esperado 'master'.`);
        return res.status(403).json({ error: "Apenas usuários 'master' podem listar sessões." });
    }

    console.log(`Buscando sessões para atendimento ID: ${attendanceId}`);

    try {
        console.log(`Verificando atendimento ${attendanceId} para usuário ${user.user_id}`);
        const attendance = db.prepare(`
            SELECT a.id AS attendance_id, a.client_id
            FROM attendances a
            JOIN clients c ON a.client_id = c.client_id
            WHERE a.id = ? AND c.user_id = ?
        `).get(attendanceId, user.user_id);
        if (!attendance) {
            console.log(`Atendimento ${attendanceId} não encontrado ou não pertence ao usuário ${user.user_id}`);
            return res.status(404).json({ error: 'Atendimento não encontrado ou acesso negado.' });
        }

        console.log(`Buscando sessões para atendimento ${attendanceId}`);
        const sessions = db.prepare(`
            SELECT session_id, user_id, client_id, attendance_id, last_updated_at
            FROM sessions
            WHERE attendance_id = ?
            ORDER BY last_updated_at DESC
        `).all(attendanceId);

        console.log(`Encontradas ${sessions.length} sessões para atendimento ID: ${attendanceId}`);
        res.json({ sessions: sessions || [] });
    } catch (dbError) {
        console.error(`Erro de banco de dados ao buscar sessões para atendimento ${attendanceId}:`, dbError.stack);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar sessões.', details: dbError.message });
    }
});

// GET /attendances/:attendanceId (buscar detalhes de um atendimento específico)
router.get('/attendances/:attendanceId', authenticateToken, (req, res) => {
    const { attendanceId } = req.params;
    const user = req.user;

    if (!user || !user.user_id) {
        console.log("Falha na autenticação: Token ausente ou inválido.");
        return res.status(401).json({ error: "Autenticação necessária para buscar detalhes do atendimento." });
    }
    if (user.role !== 'master') {
        console.log(`Falha na autorização: Usuário ${user.user_id} tem role ${user.role}, esperado 'master'.`);
        return res.status(403).json({ error: "Apenas usuários 'master' podem buscar detalhes de atendimentos." });
    }

    console.log(`Buscando detalhes do atendimento ID: ${attendanceId}`);

    try {
        const attendance = db.prepare(`
            SELECT a.id AS attendance_id, a.client_id, a.user_id, a.description, a.purpose, a.purpose_detail, a.created_at, a.last_updated_at
            FROM attendances a
            JOIN clients c ON a.client_id = c.client_id
            WHERE a.id = ? AND c.user_id = ?
        `).get(attendanceId, user.user_id);

        if (!attendance) {
            console.log(`Atendimento ${attendanceId} não encontrado ou não pertence ao usuário ${user.user_id}`);
            return res.status(404).json({ error: 'Atendimento não encontrado ou acesso negado.' });
        }

        console.log(`Atendimento ${attendanceId} encontrado:`, attendance);
        res.json({ attendance });
    } catch (dbError) {
        console.error(`Erro de banco de dados ao buscar atendimento ${attendanceId}:`, dbError.stack);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar atendimento.', details: dbError.message });
    }
});

module.exports = router;