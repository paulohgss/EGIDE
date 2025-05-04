// backend/routes/sessions.js
const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// GET /session-history/:session_id
router.get('/session-history/:session_id', authenticateToken, (req, res) => {
  const { session_id } = req.params;
  const user_id = req.user?.user_id;

  if (!session_id) {
    return res.status(400).json({ error: "ID da sessão é obrigatório." });
  }

  console.log(`Buscando histórico para session_id: ${session_id}, user_id (autenticado): ${user_id || 'Nenhum (anônimo?)'}`);

  try {
    let row;
    if (user_id) {
      console.log(`Consulta com user_id: ${user_id}`);
      row = db.prepare('SELECT history FROM session_history WHERE session_id = ? AND user_id = ?').get(session_id, user_id);
    } else {
      console.log("Consulta sem user_id (anônimo ou token ausente/inválido).");
      row = db.prepare('SELECT history FROM session_history WHERE session_id = ?').get(session_id);
    }

    if (!row) {
      console.log(`Histórico não encontrado para session_id: ${session_id} (com critério user_id: ${user_id || 'N/A'})`);
      return res.status(404).json({ error: 'Histórico da sessão não encontrado ou acesso negado.' });
    }

    let historyData = [];
    try {
      historyData = row.history ? JSON.parse(row.history) : [];
    } catch (parseError) {
      console.error(`Erro ao fazer parse do histórico JSON do DB (session: ${session_id}):`, parseError);
      return res.status(500).json({ error: 'Erro interno ao ler dados do histórico.' });
    }
    console.log(`Histórico encontrado para session_id: ${session_id}. Número de entradas: ${historyData.length}`);
    res.json({ history: historyData });
  } catch (dbError) {
    console.error(`Erro de banco de dados ao recuperar histórico (session: ${session_id}):`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao acessar o banco de dados.' });
  }
});

module.exports = router;