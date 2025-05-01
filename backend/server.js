
//server.js

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const fs = require('fs'); // Módulo para ler arquivos
const path = require('path'); // Módulo para lidar com caminhos
require('dotenv').config(); // Para carregar variáveis de ambiente (.env)

const app = express();

// Middlewares básicos
app.use(cors()); // Habilita CORS para permitir requisições do frontend
app.use(express.json()); // Habilita o parsing de JSON no corpo das requisições
app.use(express.static('.')); // Serve arquivos estáticos (como index.html, css, js) do diretório raiz

// --- Configuração do Banco de Dados SQLite ---
const db = new Database('egide.db', { verbose: console.log }); // Conecta/cria o banco

// Garante que as tabelas existam
db.exec(`
  CREATE TABLE IF NOT EXISTS session_history (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- Adicionado NOT NULL
    history TEXT,          -- Armazenará o histórico como JSON string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL, -- Adicionado NOT NULL
    password TEXT NOT NULL,        -- Adicionado NOT NULL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log("Banco de dados SQLite inicializado e tabelas verificadas.");

// --- Middleware de Autenticação (Verifica Token JWT) ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Pega o token do header 'Bearer TOKEN'

  // Permite acesso sem token para certas rotas ou se o login ainda não foi implementado
  // Em produção, rotas que exigem login devem retornar 401 se não houver token.
  if (token == null) {
     // Se quiser tornar obrigatório para /api/call-bot ou /api/session-history:
     // if (req.path.startsWith('/api/call-bot') || req.path.startsWith('/api/session-history')) {
     //    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
     // }
     return next(); // Por enquanto, permite continuar sem token
  }

  jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_aqui', (err, user) => {
    if (err) {
      console.warn('Tentativa de acesso com token inválido:', err.message);
      // Token inválido ou expirado
      // Poderia retornar 403 Forbidden ou 401 Unauthorized dependendo da política
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    // Token válido, anexa informações do usuário (payload do token) à requisição
    req.user = user;
    console.log(`Token verificado para user_id: ${user.user_id}`);
    next(); // Passa para a próxima função (o handler da rota)
  });
};

// --- Função SIMPLIFICADA para obter o prompt do sistema ---
// Lê o conteúdo COMPLETO do arquivo de base correspondente ao role.
function getSystemPrompt(role) {
  const basePath = path.join(__dirname, 'bases'); // Assume que a pasta 'bases' está no mesmo nível que server.js
  const filePath = path.join(basePath, `base_${role}.txt`); // Nome do arquivo direto (ex: base_medico.txt)
  const defaultPrompt = 'Você é um assistente útil.'; // Prompt padrão

  try {
    if (fs.existsSync(filePath)) {
      const promptContent = fs.readFileSync(filePath, 'utf-8');
      // Retorna o conteúdo do arquivo ou um prompt padrão se o arquivo estiver vazio
      return promptContent.trim() !== '' ? promptContent.trim() : defaultPrompt;
    } else {
      console.warn(`Arquivo de prompt não encontrado para role "${role}": ${filePath}. Usando prompt padrão.`);
      // Retorna um prompt padrão se o arquivo não existir
      return defaultPrompt;
    }
  } catch (err) {
    console.error(`Erro ao ler arquivo de prompt para role "${role}" (${filePath}):`, err);
    // Retorna um prompt padrão em caso de erro de leitura
    return defaultPrompt;
  }
}

// --- Endpoints da API ---

// Endpoint de Registro de Usuário
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
  }
  if (password.length < 6) { // Exemplo de validação de senha
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const existingUser = db.prepare('SELECT user_id FROM users WHERE username = ?').get(username);
    if (existingUser) {
        console.log(`Tentativa de registro falhou: usuário ${username} já existe.`);
        return res.status(409).json({ error: 'Nome de usuário já está em uso.' }); // 409 Conflict
    }

    const hashedPassword = await bcrypt.hash(password, 10); // Gera hash da senha
    const user_id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`; // Gera ID único
    const stmt = db.prepare('INSERT INTO users (user_id, username, password) VALUES (?, ?, ?)');
    stmt.run(user_id, username, hashedPassword); // Insere no banco

    console.log(`Usuário registrado: ${username} (ID: ${user_id})`);
    res.status(201).json({ success: true, user_id }); // 201 Created

  } catch (err) {
    console.error('Erro interno ao registrar usuário:', err);
    res.status(500).json({ error: 'Erro interno ao registrar usuário.' });
  }
});

// Endpoint de Login de Usuário
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
   if (!username || !password) {
    return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
  }

  try {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!row) {
      console.log(`Tentativa de login falhou para usuário inexistente: ${username}`);
      return res.status(401).json({ error: 'Credenciais inválidas.' }); // 401 Unauthorized
    }

    // Compara a senha fornecida com o hash armazenado
    const match = await bcrypt.compare(password, row.password);
    if (!match) {
      console.log(`Tentativa de login falhou para usuário ${username}: senha incorreta.`);
      return res.status(401).json({ error: 'Credenciais inválidas.' }); // 401 Unauthorized
    }

    // Gera o token JWT se as credenciais estiverem corretas
    const tokenPayload = { user_id: row.user_id, username: row.username };
    const jwtSecret = process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_aqui'; // USE VARIÁVEL DE AMBIENTE!
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '1h' }); // Token expira em 1 hora

    console.log(`Login bem-sucedido para usuário: ${username}`);
    res.json({ token, user_id: row.user_id, username: row.username }); // Retorna o token e dados do usuário

  } catch (err) {
    console.error('Erro interno ao fazer login:', err);
    res.status(500).json({ error: 'Erro interno ao fazer login.' });
  }
});

// Endpoint Principal para Chamada dos Bots
app.post('/api/call-bot', authenticateToken, async (req, res) => {
  const { role, message, session_id } = req.body;
  // Obtém user_id do token (se autenticado) ou do corpo (permitindo anônimo se frontend enviar)
  const user_id = req.user?.user_id || req.body.user_id;

  console.log('Requisição /api/call-bot:', { role, message: message?.substring(0,50)+'...', session_id, user_id: user_id || 'Não fornecido' });

   if (!role || !message) {
        return res.status(400).json({ error: 'Parâmetros "role" e "message" são obrigatórios.' });
   }
   if (!process.env.OPENAI_API_KEY) {
       console.error("FATAL: OPENAI_API_KEY não definida no ambiente.");
       return res.status(500).json({ error: "Erro de configuração do servidor." });
   }

  try {
    // Obtém o prompt completo do arquivo correspondente ao role
    const finalSystemPrompt = getSystemPrompt(role);

    if (finalSystemPrompt === 'Você é um assistente útil.') {
        console.warn(`Usando prompt padrão para role "${role}". Verifique o arquivo base correspondente.`);
    }

    console.log(`Enviando para OpenAI (Role: ${role}). Prompt System (início): ${finalSystemPrompt.substring(0, 100)}...`);

    // Faz a chamada para a API da OpenAI
    const response = await axios.post(
      process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions', // Usa variável de ambiente ou default
      {
        model: process.env.OPENAI_MODEL || 'gpt-4-0613', // Usa variável de ambiente ou default
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: message }
        ]
        // Poderia adicionar outros parâmetros como temperature, max_tokens aqui se necessário
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000 // Timeout de 90 segundos para a requisição da OpenAI
      }
    );

    console.log(`Resposta recebida da OpenAI (Role: ${role}). Status: ${response.status}`);

    // Salva no histórico se tivermos user_id e uma resposta válida
    const current_session_id = session_id || `session_${Date.now()}_${user_id || 'anon'}`; // Gera ID de sessão se não fornecido
    if (user_id && response.data.choices && response.data.choices.length > 0) {
        const reply = response.data.choices[0].message.content.trim();
        try {
            const row = db.prepare('SELECT history FROM session_history WHERE session_id = ? AND user_id = ?').get(current_session_id, user_id);
            const currentHistory = row ? JSON.parse(row.history) : [];
            // Estrutura para salvar a interação
            const interaction = { type: 'user_message_to_bot', role_called: role, content: message, timestamp: new Date().toISOString() };
            const botResponse = { type: 'bot_response', role: role, content: reply, timestamp: new Date().toISOString() };
            const updatedHistory = [...currentHistory, interaction, botResponse];

            db.prepare('INSERT OR REPLACE INTO session_history (session_id, user_id, history) VALUES (?, ?, ?)').run(
                current_session_id, user_id, JSON.stringify(updatedHistory)
            );
             console.log(`Histórico salvo/atualizado para session_id: ${current_session_id}, user_id: ${user_id}`);
        } catch (dbError) {
            console.error(`Erro ao salvar histórico no DB (session: ${current_session_id}):`, dbError);
        }
    } else if (!user_id) {
         console.warn("Histórico não salvo: user_id não fornecido.");
    } else {
         console.warn("Histórico não salvo: Resposta da OpenAI não continha 'choices'.");
    }

    // Retorna a resposta COMPLETA da OpenAI para o frontend
    const responseData = { ...response.data };
     // Adiciona o session_id ao objeto se ele foi gerado no backend
     if (current_session_id !== session_id) {
         responseData.generated_session_id = current_session_id;
         console.log(`Novo session_id gerado e retornado: ${current_session_id}`);
     }
     res.json(responseData);

  } catch (error) {
    // Tratamento de Erros (OpenAI, Rede, Interno)
    let statusCode = 500;
    let errorMessage = 'Erro interno do servidor ao processar a requisição.';
     if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
         console.error('Erro: Timeout na chamada para OpenAI.');
         statusCode = 504; // Gateway Timeout
         errorMessage = 'O serviço de IA demorou muito para responder.';
     } else if (error.response) {
        // Erro retornado pela API da OpenAI
        console.error(`Erro da API OpenAI: Status ${error.response.status}`, error.response.data);
        statusCode = error.response.status >= 500 ? 502 : 500; // 502 Bad Gateway se for erro 5xx da OpenAI
        errorMessage = `Erro ao comunicar com o serviço de IA (Status: ${error.response.status})`;
        if (error.response.status === 400) errorMessage = "Requisição inválida para a API OpenAI (verifique o prompt/modelo).";
        if (error.response.status === 401) errorMessage = "Chave da API OpenAI inválida ou não autorizada.";
        if (error.response.status === 429) errorMessage = "Limite de requisições da API OpenAI atingido.";
    } else if (error.request) {
        // Requisição feita mas sem resposta (problema de rede?)
        console.error('Erro de rede ao chamar OpenAI (sem resposta):', error.message);
        statusCode = 504; // Gateway Timeout
        errorMessage = 'Não foi possível conectar ao serviço de IA.';
    } else {
        // Erro na configuração da requisição ou outro erro interno
        console.error('Erro interno não esperado no backend:', error.message);
        errorMessage = `Erro inesperado no servidor.`;
    }
    res.status(statusCode).json({ error: errorMessage });
  }
});

// Endpoint para Recuperar Histórico de Sessão
app.get('/api/session-history/:session_id', authenticateToken, (req, res) => {
  const { session_id } = req.params;
  const user_id = req.user?.user_id; // Obtém user_id do token verificado

  // Requer autenticação para esta rota
  if (!user_id) {
      return res.status(401).json({ error: "Autenticação necessária para acessar o histórico." });
  }
   if (!session_id) {
       return res.status(400).json({ error: "ID da sessão é obrigatório." });
   }

  console.log(`Buscando histórico para session_id: ${session_id}, user_id: ${user_id}`);
  try {
    // Busca o histórico específico da sessão E do usuário autenticado
    const row = db.prepare('SELECT history FROM session_history WHERE session_id = ? AND user_id = ?').get(session_id, user_id);

    if (!row) {
        // Sessão não encontrada OU não pertence a este usuário
        console.log(`Histórico não encontrado ou acesso negado para session_id: ${session_id}, user_id: ${user_id}`);
        return res.status(404).json({ error: 'Histórico da sessão não encontrado.' });
    }

    // Retorna o histórico parseado (ou array vazio se for nulo/inválido)
    res.json({ history: row.history ? JSON.parse(row.history) : [] });

  } catch (err) {
    console.error(`Erro ao recuperar histórico (session: ${session_id}):`, err);
    res.status(500).json({ error: 'Erro interno ao recuperar o histórico da sessão.' });
  }
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Egide-Juridico rodando na porta ${PORT}`);
  console.log(`Acesse o frontend em: http://localhost:${PORT}`); // Ou o endereço correto do frontend
  if (!process.env.OPENAI_API_KEY) {
      console.warn("AVISO: Variável de ambiente OPENAI_API_KEY não definida!");
  }
   if (!process.env.JWT_SECRET) {
      console.warn("AVISO: Variável de ambiente JWT_SECRET não definida! Usando chave padrão insegura.");
  }
});