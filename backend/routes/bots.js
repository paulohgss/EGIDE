// backend/routes/bots.js
const express = require('express');
const axios = require('axios');
const db = require('../db');
const { authenticateToken } = require('../middlewares/auth');

// Inicializar o router
const router = express.Router();

// Função para obter o prompt do sistema
function getSystemPrompt(role) {
    return `Você é um ${role}. Forneça uma resposta detalhada e precisa.`;
}

// Definir o endpoint /call-bot
router.post('/call-bot', authenticateToken, async (req, res) => {
    const { role, message, session_id, client_id, attendance_id } = req.body;
    const user = req.user;
    const user_id = user?.user_id;

    console.log('Requisição /api/call-bot:', {
        role,
        message: message?.substring(0, 50) + '...',
        session_id: session_id || '(Nova Sessão)',
        client_id: client_id || '(Nenhum)',
        attendance_id: attendance_id || '(Nenhum)',
        user_id: user_id || 'Não fornecido (anônimo?)'
    });

    if (!role || !message) {
        return res.status(400).json({ error: 'Parâmetros "role" e "message" são obrigatórios.' });
    }
    if (!process.env.OPENAI_API_KEY) {
        console.error("FATAL: OPENAI_API_KEY não definida no ambiente.");
        return res.status(500).json({ error: "Erro de configuração do servidor." });
    }

    const isNewSession = !session_id;
    const current_session_id = session_id || `session_${Date.now()}_${user_id || 'anon'}`;
    const effective_user_id = user_id || 'anon';

    if (isNewSession && !client_id) {
        console.warn(`Iniciando NOVA sessão (${current_session_id}) sem um client_id associado.`);
    } else if (isNewSession && client_id) {
        console.log(`Nova sessão (${current_session_id}) será associada ao cliente ${client_id}`);
    }
    if (isNewSession && attendance_id) {
        console.log(`Nova sessão (${current_session_id}) será associada ao atendimento ${attendance_id}`);
    }

    try {
        const finalSystemPrompt = getSystemPrompt(role);
        console.log(`Enviando para OpenAI (Role: ${role}). Prompt System (início): ${finalSystemPrompt.substring(0, 100)}...`);

        const response = await axios.post(
            process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
            {
                model: process.env.OPENAI_MODEL || 'gpt-4o',
                messages: [
                    { role: 'system', content: finalSystemPrompt },
                    { role: 'user', content: message }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 90000
            }
        );
        console.log(`Resposta recebida da OpenAI (Role: ${role}). Status: ${response.status}`);

        if (isNewSession && client_id) {
            try {
                const clientCheck = db.prepare('SELECT client_id FROM clients WHERE client_id = ? AND user_id = ?').get(client_id, effective_user_id);
                if (!clientCheck) {
                    console.error(`Erro ao registrar sessão: Cliente ${client_id} não encontrado para usuário ${effective_user_id}`);
                    return res.status(404).json({ error: `Cliente com ID ${client_id} não encontrado.` });
                }

                if (attendance_id) {
                    const attendanceCheck = db.prepare('SELECT id FROM attendances WHERE id = ? AND client_id = ?').get(attendance_id, client_id);
                    if (!attendanceCheck) {
                        console.error(`Erro ao registrar sessão: Atendimento ${attendance_id} não encontrado para cliente ${client_id}`);
                        return res.status(404).json({ error: `Atendimento com ID ${attendance_id} não encontrado.` });
                    }
                }

                const sessionStmt = db.prepare(`
                    INSERT INTO sessions (session_id, user_id, client_id, attendance_id, last_updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                `);
                console.log('Executando query SQL:', `INSERT INTO sessions (session_id, user_id, client_id, attendance_id, last_updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`, [current_session_id, effective_user_id, client_id, attendance_id || null]);
                sessionStmt.run(current_session_id, effective_user_id, client_id, attendance_id || null);
                console.log(`Registro criado na tabela 'sessions' para session_id: ${current_session_id}, client_id: ${client_id}, attendance_id: ${attendance_id || 'Nenhum'}`);
            } catch (sessionDbError) {
                console.error(`ERRO AO REGISTRAR SESSÃO na tabela 'sessions' (session: ${current_session_id}, client: ${client_id}):`, sessionDbError);
                if (sessionDbError.code?.startsWith('SQLITE_CONSTRAINT')) {
                    return res.status(409).json({ error: "Erro ao registrar sessão devido a dados inconsistentes." });
                }
                return res.status(500).json({ error: "Erro interno ao registrar a sessão." });
            }
        }

        if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
            const reply = response.data.choices[0].message.content.trim();
            try {
                const row = db.prepare('SELECT history FROM session_history WHERE session_id = ?').get(current_session_id);
                const currentHistory = row ? JSON.parse(row.history) : [];
                const interaction = { type: 'user_message_to_bot', role_called: role, content: message, timestamp: new Date().toISOString() };
                const botResponse = { type: 'bot_response', role: role, content: reply, timestamp: new Date().toISOString() };
                const updatedHistory = [...currentHistory, interaction, botResponse];

                db.prepare('INSERT OR REPLACE INTO session_history (session_id, user_id, history) VALUES (?, ?, ?)').run(
                    current_session_id, effective_user_id, JSON.stringify(updatedHistory)
                );
                console.log(`Histórico salvo/atualizado para session_id: ${current_session_id}, effective_user_id: ${effective_user_id}`);

                if (client_id || !isNewSession) {
                    try {
                        db.prepare('UPDATE sessions SET last_updated_at = CURRENT_TIMESTAMP WHERE session_id = ?')
                            .run(current_session_id);
                    } catch (updateErr) {
                        console.error(`Erro ao atualizar last_updated_at para sessão ${current_session_id}:`, updateErr);
                    }
                }
            } catch (dbError) {
                console.error(`Erro ao salvar histórico na tabela 'session_history' (session: ${current_session_id}, user: ${effective_user_id}):`, dbError);
                return res.status(500).json({ error: "Erro interno ao salvar histórico da conversa." });
            }
        } else {
            console.warn(`Histórico não salvo (session: ${current_session_id}): Resposta da OpenAI inválida ou vazia.`, response.data);
        }

        const responseData = { ...response.data };
        if (isNewSession) {
            responseData.generated_session_id = current_session_id;
            console.log(`Novo session_id gerado e retornado: ${current_session_id}`);
        }
        res.json(responseData);
    } catch (error) {
        let statusCode = 500;
        let errorMessage = 'Erro interno do servidor ao processar a requisição.';
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            console.error('Erro: Timeout na chamada para OpenAI.');
            statusCode = 504;
            errorMessage = 'O serviço de IA demorou muito para responder.';
        } else if (error.response) {
            console.error(`Erro da API OpenAI: Status ${error.response.status}`, error.response.data);
            statusCode = error.response.status;
            errorMessage = error.response.data?.error?.message || `Erro ${statusCode} do serviço de IA.`;
            if (statusCode === 401) errorMessage = "Chave da API OpenAI inválida ou não autorizada.";
            if (statusCode === 429) errorMessage = "Limite de requisições da API OpenAI atingido.";
            if (statusCode === 400) errorMessage = "Requisição inválida para a API OpenAI.";
        } else if (error.request) {
            console.error('Erro de rede ao chamar OpenAI (sem resposta):', error.message);
            statusCode = 504;
            errorMessage = 'Não foi possível conectar ao serviço de IA.';
        } else {
            console.error('Erro interno não esperado no backend:', error.message, error.stack);
            errorMessage = `Erro inesperado no servidor.`;
        }
        if (!res.headersSent) {
            res.status(statusCode).json({ error: errorMessage, details: error.message });
        } else {
            console.error("Tentativa de enviar resposta de erro após headers já terem sido enviados.");
        }
    }
});

// Exportar o router
module.exports = router;