// backend/server.js (Versão Completa e Corrigida)

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

// --- Servir Arquivos Estáticos do Frontend ---
// Ajuste o caminho se a estrutura de pastas for diferente (ex: '../frontend')
const frontendPath = path.join(__dirname, '..', 'frontend');
console.log(`Servindo arquivos estáticos de: ${frontendPath}`);
app.use(express.static(frontendPath));
// Rota fallback para servir o index.html para Single Page Application (SPA) se necessário
// app.get('*', (req, res) => {
//   res.sendFile(path.join(frontendPath, 'index.html'));
// });


// --- Configuração do Banco de Dados SQLite ---
const db = new Database('egide.db', { verbose: console.log }); // Conecta/cria o banco

// Garante que as tabelas existam
db.exec(`
  CREATE TABLE IF NOT EXISTS session_history (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- Pode ser 'anon' ou um ID real
    history TEXT,          -- Armazenará o histórico como JSON string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log("Banco de dados SQLite inicializado e tabelas verificadas.");

// --- Middleware de Autenticação (Verifica Token JWT) ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Pega o token do header 'Bearer TOKEN'

  if (token == null) {
    // NENHUM token fornecido.
    // Para as rotas atuais (/call-bot, /session-history), PERMITIMOS continuar
    // para suportar uso anônimo. A lógica da rota decidirá o que fazer.
    console.log("Nenhum token JWT fornecido na requisição.");
    return next();
  }

  // Se um token FOI fornecido, tentamos verificá-lo.
  jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_aqui', (err, user) => {
    if (err) {
      // Token inválido (expirado, assinatura errada, etc.)
      console.warn('Tentativa de acesso com token inválido:', err.message);
      // Retorna 403 Forbidden, pois o usuário tentou se autenticar mas falhou.
      // Não deve prosseguir.
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    // Token válido, anexa informações do usuário (payload do token) à requisição
    req.user = user; // user contém { user_id, username, iat, exp }
    console.log(`Token verificado para user_id: ${user.user_id}`);
    next(); // Passa para a próxima função (o handler da rota)
  });
};

// --- Função para obter o prompt do sistema ---
function getSystemPrompt(role) {
  const basePath = path.join(__dirname, 'bases');
  const filePath = path.join(basePath, `base_${role}.txt`);
  const defaultPrompt = 'Você é um assistente útil.';

  try {
    if (fs.existsSync(filePath)) {
      const promptContent = fs.readFileSync(filePath, 'utf-8');
      return promptContent.trim() !== '' ? promptContent.trim() : defaultPrompt;
    } else {
      console.warn(`Arquivo de prompt não encontrado para role "${role}": ${filePath}. Usando prompt padrão.`);
      return defaultPrompt;
    }
  } catch (err) {
    console.error(`Erro ao ler arquivo de prompt para role "${role}" (${filePath}):`, err);
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

// Endpoint de Login de Usuário
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
   if (!username || !password) {
    return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
  }

  try {
    const row = db.prepare('SELECT user_id, username, password FROM users WHERE username = ?').get(username); // Seleciona campos necessários
    if (!row) {
      console.log(`Tentativa de login falhou para usuário inexistente: ${username}`);
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const match = await bcrypt.compare(password, row.password);
    if (!match) {
      console.log(`Tentativa de login falhou para usuário ${username}: senha incorreta.`);
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Gera o token JWT
    const tokenPayload = { user_id: row.user_id, username: row.username };
    const jwtSecret = process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_aqui'; // Use variável de ambiente!
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '1h' }); // Expira em 1 hora

    console.log(`Login bem-sucedido para usuário: ${username}`);
    res.json({ token, user_id: row.user_id, username: row.username }); // Retorna token e dados

  } catch (err) {
    console.error('Erro interno ao fazer login:', err);
    res.status(500).json({ error: 'Erro interno ao fazer login.' });
  }
});

// Endpoint Principal para Chamada dos Bots (Versão Completa e Corrigida)
app.post('/api/call-bot', authenticateToken, async (req, res) => {
  const { role, message, session_id } = req.body;
  // Usa o user_id do token verificado, se existir. Senão, será undefined.
  const user_id = req.user?.user_id;

  console.log('Requisição /api/call-bot:', { role, message: message?.substring(0, 50) + '...', session_id, user_id: user_id || 'Não fornecido (anônimo?)' });

  if (!role || !message) {
    return res.status(400).json({ error: 'Parâmetros "role" e "message" são obrigatórios.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("FATAL: OPENAI_API_KEY não definida no ambiente.");
    return res.status(500).json({ error: "Erro de configuração do servidor." });
  }

  // Define o ID da sessão e o ID do usuário a ser salvo no DB ('anon' se não houver user_id)
  // Se o frontend enviar um session_id, usamos ele; senão, geramos um novo.
  const current_session_id = session_id || `session_${Date.now()}_${user_id || 'anon'}`;
  const effective_user_id = user_id || 'anon'; // Usaremos 'anon' para salvar se não houver usuário logado

  try {
    // 1. Obtém o prompt do sistema
    const finalSystemPrompt = getSystemPrompt(role);
    if (finalSystemPrompt === 'Você é um assistente útil.') {
      console.warn(`Usando prompt padrão para role "${role}". Verifique o arquivo base correspondente.`);
    }
    console.log(`Enviando para OpenAI (Role: ${role}). Prompt System (início): ${finalSystemPrompt.substring(0, 100)}...`);

    // 2. Faz a chamada para a API da OpenAI
    const response = await axios.post(
      process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o', // Modelo atualizado (exemplo)
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: message }
        ]
        // Adicione outros parâmetros aqui se necessário (temperature, max_tokens, etc.)
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000 // Timeout de 90 segundos
      }
    );

    console.log(`Resposta recebida da OpenAI (Role: ${role}). Status: ${response.status}`);

    // 3. Lógica de Salvamento do Histórico (CORRIGIDA para salvar anônimos)
    if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
      const reply = response.data.choices[0].message.content.trim();
      try {
        // Busca histórico anterior SOMENTE pelo session_id (chave primária)
        const row = db.prepare('SELECT history FROM session_history WHERE session_id = ?').get(current_session_id);
        const currentHistory = row ? JSON.parse(row.history) : [];

        // Prepara as novas entradas
        const interaction = { type: 'user_message_to_bot', role_called: role, content: message, timestamp: new Date().toISOString() };
        const botResponse = { type: 'bot_response', role: role, content: reply, timestamp: new Date().toISOString() };
        const updatedHistory = [...currentHistory, interaction, botResponse];

        // Salva no banco usando o effective_user_id ('anon' se for o caso)
        db.prepare('INSERT OR REPLACE INTO session_history (session_id, user_id, history) VALUES (?, ?, ?)').run(
          current_session_id, effective_user_id, JSON.stringify(updatedHistory)
        );
        console.log(`Histórico salvo/atualizado para session_id: ${current_session_id}, effective_user_id: ${effective_user_id}`);

      } catch (dbError) {
        console.error(`Erro ao salvar histórico no DB (session: ${current_session_id}, user: ${effective_user_id}):`, dbError);
        // Considerar relançar o erro se a falha no DB for crítica
        // throw dbError;
      }
    } else {
      console.warn(`Histórico não salvo (session: ${current_session_id}): Resposta da OpenAI inválida ou vazia.`, response.data);
    }

    // 4. Prepara e envia a resposta para o Frontend
    const responseData = { ...response.data };
    // Adiciona o session_id gerado se ele for diferente do recebido (indicando nova sessão)
    if (current_session_id !== session_id) {
      responseData.generated_session_id = current_session_id;
      console.log(`Novo session_id gerado e retornado: ${current_session_id}`);
    }
    res.json(responseData); // Envia a resposta da OpenAI (e talvez o novo session_id)

  } catch (error) { // Trata erros da chamada axios ou erros relançados do DB
    let statusCode = 500;
    let errorMessage = 'Erro interno do servidor ao processar a requisição.';

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('Erro: Timeout na chamada para OpenAI.');
      statusCode = 504; // Gateway Timeout
      errorMessage = 'O serviço de IA demorou muito para responder.';
    } else if (error.response) { // Erro da API OpenAI (resposta recebida com status != 2xx)
      console.error(`Erro da API OpenAI: Status ${error.response.status}`, error.response.data);
      statusCode = error.response.status; // Usa o status code da OpenAI
      // Tenta pegar mensagem de erro da OpenAI, senão usa uma genérica
      errorMessage = error.response.data?.error?.message || `Erro ${statusCode} do serviço de IA.`;
      // Mensagens mais específicas (opcional)
      if (statusCode === 401) errorMessage = "Chave da API OpenAI inválida ou não autorizada.";
      if (statusCode === 429) errorMessage = "Limite de requisições da API OpenAI atingido.";
      if (statusCode === 400) errorMessage = "Requisição inválida para a API OpenAI (verifique o prompt/modelo).";

    } else if (error.request) { // Erro de rede (sem resposta)
      console.error('Erro de rede ao chamar OpenAI (sem resposta):', error.message);
      statusCode = 504; // Gateway Timeout
      errorMessage = 'Não foi possível conectar ao serviço de IA.';
    } else { // Outro erro (configuração, DB relançado, etc.)
      console.error('Erro interno não esperado no backend:', error.message, error.stack);
      errorMessage = `Erro inesperado no servidor.`;
    }
    // Envia a resposta de erro padronizada para o frontend
    res.status(statusCode).json({ error: errorMessage, details: error.message }); // Inclui detalhe do erro original
  }
}); // Fim do app.post('/api/call-bot')

// Endpoint para Recuperar Histórico de Sessão (MODIFICADO)
app.get('/api/session-history/:session_id', authenticateToken, (req, res) => {
  const { session_id } = req.params;
  // Obtém user_id do token verificado (pode ser undefined se não houver token ou se for inválido e authenticateToken permitir passar)
  const user_id = req.user?.user_id;

  if (!session_id) {
    return res.status(400).json({ error: "ID da sessão é obrigatório." });
  }

  console.log(`Buscando histórico para session_id: ${session_id}, user_id (autenticado): ${user_id || 'Nenhum (anônimo?)'}`);

  try {
    let row;
    // Se TEM um usuário autenticado (veio do token), busca por session_id E user_id
    if (user_id) {
      console.log(`Consulta com user_id: ${user_id}`);
      row = db.prepare('SELECT history FROM session_history WHERE session_id = ? AND user_id = ?').get(session_id, user_id);
    } else {
      // Se NÃO TEM usuário autenticado (ou token inválido e permitimos passar), busca SÓ pelo session_id
      console.log("Consulta sem user_id (anônimo ou token ausente/inválido).");
      row = db.prepare('SELECT history FROM session_history WHERE session_id = ?').get(session_id);
    }

    if (!row) {
      // Não encontrou a sessão OU (se user_id foi usado) o usuário logado não é o dono
      console.log(`Histórico não encontrado para session_id: ${session_id} (com critério user_id: ${user_id || 'N/A'})`);
      return res.status(404).json({ error: 'Histórico da sessão não encontrado ou acesso negado.' }); // Mensagem um pouco mais clara
    }

    // Retorna o histórico parseado (ou array vazio se for nulo/inválido no DB)
    let historyData = [];
    try {
        historyData = row.history ? JSON.parse(row.history) : [];
    } catch (parseError) {
        console.error(`Erro ao fazer parse do histórico JSON do DB (session: ${session_id}):`, parseError);
        // Retorna erro 500 pois os dados no DB estão corrompidos
        return res.status(500).json({ error: 'Erro interno ao ler dados do histórico.' });
    }
    console.log(`Histórico encontrado para session_id: ${session_id}. Número de entradas: ${historyData.length}`);
    res.json({ history: historyData }); // Retorna um objeto { history: [...] }

  } catch (dbError) {
    console.error(`Erro de banco de dados ao recuperar histórico (session: ${session_id}):`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao acessar o banco de dados.' });
  }
}); // Fim do app.get('/api/session-history/:session_id')

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Égide rodando na porta ${PORT}`);
  console.log(`Acesse o frontend em: http://localhost:${PORT}`); // Ajuste se servir de outro local
  if (!process.env.OPENAI_API_KEY) {
    console.warn("AVISO IMPORTANTE: Variável de ambiente OPENAI_API_KEY não definida!");
  }
   if (!process.env.JWT_SECRET) {
    console.warn("AVISO: Variável de ambiente JWT_SECRET não definida! Usando chave padrão insegura para JWT.");
  }
});