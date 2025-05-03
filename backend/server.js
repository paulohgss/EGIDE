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
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'master', -- Define o papel/role do usuário
    master_user_id TEXT,      -- Guarda o ID do Master se for um Auxiliar
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (master_user_id) REFERENCES users(user_id) ON DELETE SET NULL -- Opcional: se master for deletado, assistente fica sem master
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- ID do advogado/master que cadastrou
    name TEXT NOT NULL,
    cpf TEXT UNIQUE,      -- CPF deve ser único em todo o sistema
    dob TEXT,             -- Data de Nascimento (formato AAAA-MM-DD)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE -- Se advogado/master for deletado, seus clientes vão junto
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS session_history (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- Pode ser 'anon' ou um ID real
    history TEXT,          -- Armazenará o histórico como JSON string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- Não precisa de FK aqui, pois session_id pode não estar em 'sessions' (ex: sessões anônimas)
  );
`);

// ADICIONE ESTE BLOCO PARA A TABELA SESSIONS:
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    title TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
  );
`);
// FIM DO BLOCO ADICIONADO

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
// Em backend/server.js

// Endpoint de Login de Usuário (MODIFICADO para incluir role no JWT)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
   if (!username || !password) {
    return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
  }

  try {
    // <<< MODIFICAÇÃO 1: Seleciona também a coluna 'role' >>>
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

    // <<< MODIFICAÇÃO 2: Inclui 'role' no payload do token >>>
    const tokenPayload = {
        user_id: row.user_id,
        username: row.username,
        role: row.role // Adiciona o papel do usuário ao token
    };
    const jwtSecret = process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_aqui'; // Use variável de ambiente!
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '1h' }); // Expira em 1 hora

    console.log(`Login bem-sucedido para usuário: ${username} (Role: ${row.role})`);
    // Retorna o token e os dados do usuário (incluindo o role para o frontend, opcionalmente)
    res.json({ token, user_id: row.user_id, username: row.username, role: row.role });

  } catch (err) {
    console.error('Erro interno ao fazer login:', err);
    res.status(500).json({ error: 'Erro interno ao fazer login.' });
  }
}); // Fim do app.post('/api/login')


// Em backend/server.js

// --- Endpoints de Clientes ---

// Endpoint para Listar Clientes do Usuário Logado
app.get('/api/clients', authenticateToken, (req, res) => {
  const user = req.user; // Dados do usuário logado (do token)

  // Verifica se o usuário está autenticado (token válido)
  if (!user || !user.user_id) {
    return res.status(401).json({ error: "Autenticação necessária para listar clientes." });
  }

  // Nota: Por enquanto, qualquer usuário logado (master ou auxiliar) pode listar
  // os clientes associados ao seu user_id (que no caso de auxiliar, deveria ser
  // filtrado pelos casos/clientes atribuídos, mas faremos isso depois).
  // Para Masters, isso busca os clientes que ELES cadastraram.
  console.log(`Buscando lista de clientes para user_id: ${user.user_id} (Role: ${user.role})`);

  try {
    // Busca clientes cujo user_id corresponde ao do usuário logado
    const clients = db.prepare(`
      SELECT client_id, name, cpf, dob, created_at
      FROM clients
      WHERE user_id = ?
      ORDER BY name ASC
    `).all(user.user_id);

    console.log(`Encontrados ${clients.length} clientes para user_id: ${user.user_id}`);
    res.json({ clients: clients || [] }); // Retorna a lista

  } catch (dbError) {
    console.error(`Erro de banco de dados ao listar clientes para user_id ${user.user_id}:`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar clientes.' });
  }
}); // Fim do app.get('/api/clients')

// Endpoint para Cadastrar um Novo Cliente
app.post('/api/clients', authenticateToken, (req, res) => {
  const user = req.user; // Dados do usuário logado

  // Garante que o usuário está logado
  if (!user || !user.user_id) {
    return res.status(401).json({ error: "Autenticação necessária para cadastrar clientes." });
  }

  // TODO: Adicionar verificação de role aqui? Quem pode cadastrar? Master? Auxiliar?
  // Por agora, vamos permitir que qualquer usuário logado cadastre (associado a ele mesmo).
  console.log(`Usuário ${user.username} (ID: ${user.user_id}, Role: ${user.role}) tentando cadastrar cliente.`);

  // Pega dados do cliente do corpo da requisição
  const { name, cpf, dob } = req.body;

  // Validações básicas (Backend)
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Nome do cliente é obrigatório.' });
  }
  // Validação simples de formato de CPF (apenas números, 11 dígitos) - pode melhorar
  const cleanedCpf = cpf ? cpf.replace(/\D/g, '') : null;
  if (cleanedCpf && cleanedCpf.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos.' });
  }
  // Validação simples de formato de Data de Nascimento (YYYY-MM-DD)
   if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
       return res.status(400).json({ error: 'Formato inválido para Data de Nascimento (use AAAA-MM-DD).' });
   }

  console.log(`Tentando cadastrar cliente '${name}' para user_id: ${user.user_id}`);

  try {
    // Verifica se já existe cliente com mesmo CPF para este advogado
    // A constraint UNIQUE no DB pegaria isso também, mas verificar antes dá um erro melhor (409)
    if (cleanedCpf) {
        // ATENÇÃO: A constraint UNIQUE no DB é GERAL. Um CPF só pode existir uma vez.
        // A lógica abaixo verificava apenas para o MESMO advogado, o que está errado se CPF for UNIQUE geral.
        // Vamos verificar na tabela inteira.
        // const existingClient = db.prepare('SELECT client_id FROM clients WHERE cpf = ? AND user_id = ?').get(cleanedCpf, user.user_id);
        const existingClient = db.prepare('SELECT client_id, user_id FROM clients WHERE cpf = ?').get(cleanedCpf);
        if (existingClient) {
            console.warn(`CPF ${cleanedCpf} já cadastrado para client_id ${existingClient.client_id} (advogado ${existingClient.user_id})`);
            return res.status(409).json({ error: 'Este CPF já está cadastrado no sistema.' }); // 409 Conflict
        }
    }

    // Gera um ID único para o cliente
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Insere o novo cliente, associando ao user_id do advogado logado
    const stmt = db.prepare(`
      INSERT INTO clients (client_id, user_id, name, cpf, dob)
      VALUES (?, ?, ?, ?, ?)
    `);
    // Salva o CPF limpo (só números) ou null
    stmt.run(clientId, user.user_id, name.trim(), cleanedCpf, dob || null);

    console.log(`Cliente cadastrado: ${name} (ID: ${clientId}) para user_id: ${user.user_id}`);

    // Retorna sucesso com os dados do cliente criado
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
    }); // 201 Created

  } catch (dbError) {
     // Verifica se o erro é de UNIQUE constraint (embora tenhamos checado antes)
     if (dbError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
         console.error(`Erro de constraint UNIQUE ao cadastrar cliente (CPF: ${cleanedCpf}):`, dbError.message);
         return res.status(409).json({ error: 'Erro: CPF já existe.' });
     }
    console.error(`Erro de banco de dados ao cadastrar cliente para user_id ${user.user_id}:`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao cadastrar cliente.' });
  }
}); // Fim do app.post('/api/clients')

// Endpoint para Master Criar um Assistente
app.post('/api/assistants', authenticateToken, async (req, res) => {
  // 1. Verifica se quem está chamando é um Master
  const masterUser = req.user; // Dados do usuário logado (do token)
  if (!masterUser || masterUser.role !== 'master') {
    console.warn(`Tentativa não autorizada de criar assistente por user_id: ${masterUser?.user_id} com role: ${masterUser?.role}`);
    return res.status(403).json({ error: "Apenas usuários 'master' podem criar assistentes." }); // 403 Forbidden
  }

  // 2. Pega os dados do novo assistente do corpo da requisição
  const { username: assistantUsername, password: assistantPassword } = req.body;

  // 3. Validações básicas dos dados recebidos
  if (!assistantUsername || !assistantPassword) {
    return res.status(400).json({ error: 'Nome de usuário e senha do assistente são obrigatórios.' });
  }
  if (assistantPassword.length < 6) {
    return res.status(400).json({ error: 'Senha do assistente deve ter pelo menos 6 caracteres.' });
  }
  // Poderíamos adicionar mais validações no username aqui (caracteres permitidos, etc.)

  try {
    // 4. Verifica se o username do assistente já existe
    const existingUser = db.prepare('SELECT user_id FROM users WHERE username = ?').get(assistantUsername);
    if (existingUser) {
      console.log(`Tentativa de criar assistente falhou: usuário ${assistantUsername} já existe.`);
      return res.status(409).json({ error: 'Nome de usuário já está em uso.' }); // 409 Conflict
    }

    // 5. Cria o hash da senha do assistente
    const hashedPassword = await bcrypt.hash(assistantPassword, 10);

    // 6. Gera um ID único para o assistente
    const assistantUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 7. Insere o novo assistente no banco
    const stmt = db.prepare(`
      INSERT INTO users (user_id, username, password, role, master_user_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    // Define role como 'auxiliar' e master_user_id como o ID do Master logado
    stmt.run(assistantUserId, assistantUsername, hashedPassword, 'auxiliar', masterUser.user_id);

    console.log(`Assistente criado: ${assistantUsername} (ID: ${assistantUserId}) pelo Master: ${masterUser.username} (ID: ${masterUser.user_id})`);

    // 8. Retorna sucesso
    // Não retorna a senha, claro. Retorna dados úteis para o frontend.
    res.status(201).json({
        success: true,
        message: 'Assistente criado com sucesso.',
        assistant: {
            user_id: assistantUserId,
            username: assistantUsername,
            role: 'auxiliar',
            master_user_id: masterUser.user_id
        }
     }); // 201 Created

  } catch (err) {
    console.error(`Erro interno ao criar assistente pelo Master ${masterUser.user_id}:`, err);
    res.status(500).json({ error: 'Erro interno ao criar assistente.' });
  }
}); // Fim do app.post('/api/assistants')


// Em backend/server.js (adicionar após POST /api/assistants)

// Endpoint para Master Listar seus Assistentes
app.get('/api/assistants', authenticateToken, (req, res) => {
  // 1. Verifica se quem está chamando é um Master
  const masterUser = req.user;
  if (!masterUser || masterUser.role !== 'master') {
    // Retorna 403 mesmo que não seja estritamente necessário para GET, por consistência
    // Ou poderia retornar um array vazio? Decidimos retornar 403.
    console.warn(`Tentativa não autorizada de listar assistentes por user_id: ${masterUser?.user_id} com role: ${masterUser?.role}`);
    return res.status(403).json({ error: "Apenas usuários 'master' podem listar assistentes." });
  }

  const masterUserId = masterUser.user_id;
  console.log(`Buscando lista de assistentes para Master ID: ${masterUserId}`);

  try {
    // 2. Busca todos os usuários que são 'auxiliar' E têm o master_user_id correspondente
    const assistants = db.prepare(`
      SELECT user_id, username, role, master_user_id, created_at
      FROM users
      WHERE role = 'auxiliar' AND master_user_id = ?
      ORDER BY created_at DESC
    `).all(masterUserId);

    console.log(`Encontrados ${assistants.length} assistentes para Master ID: ${masterUserId}`);

    // 3. Retorna a lista (pode estar vazia)
    res.json({ assistants: assistants || [] }); // Garante que é um array

  } catch (dbError) {
    console.error(`Erro de banco de dados ao listar assistentes para Master ID ${masterUserId}:`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar assistentes.' });
  }
}); // Fim do app.get('/api/assistants')



// Em backend/server.js

// Em backend/server.js

// Endpoint Principal para Chamada dos Bots (MODIFICADO para registrar na tabela sessions)
app.post('/api/call-bot', authenticateToken, async (req, res) => {
  // <<< MUDANÇA 1: Pega client_id do corpo também >>>
  const { role, message, session_id, client_id } = req.body;
  const user = req.user; // Dados do usuário logado (pode ser undefined se anônimo)
  const user_id = user?.user_id; // Pega o ID do usuário logado, se houver

  // Log aprimorado
  console.log('Requisição /api/call-bot:', {
      role,
      message: message?.substring(0, 50) + '...',
      session_id: session_id || '(Nova Sessão)', // Indica se é nova
      client_id: client_id || '(Nenhum)', // Mostra client_id se veio
      user_id: user_id || 'Não fornecido (anônimo?)'
  });

  // Validações básicas
  if (!role || !message) {
    return res.status(400).json({ error: 'Parâmetros "role" e "message" são obrigatórios.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("FATAL: OPENAI_API_KEY não definida no ambiente.");
    return res.status(500).json({ error: "Erro de configuração do servidor." });
  }

  // Define o ID da sessão e o ID do usuário efetivo para salvar no DB
  const isNewSession = !session_id; // Verifica se é uma nova sessão
  // <<< MUDANÇA 2: Garante que user_id seja pego do token ou 'anon' >>>
  const effective_user_id = user?.user_id || 'anon'; // Usa user_id do token se existir, senão 'anon'
  const current_session_id = session_id || `session_${Date.now()}_${effective_user_id}`;

  // <<< MUDANÇA 3: Validação do client_id se for nova sessão >>>
  if (isNewSession && !client_id) {
      // Se é uma nova sessão vinda do fluxo principal (index.html direto), não terá client_id.
      // OK continuar, apenas logamos.
      console.warn(`Iniciando NOVA sessão (${current_session_id}) sem um client_id associado.`);
  } else if (isNewSession && client_id) {
      // É uma nova sessão E veio com client_id (provavelmente de clients.html)
       console.log(`Nova sessão (${current_session_id}) será associada ao cliente ${client_id}`);
       // Validação do cliente ocorrerá ANTES de inserir na tabela sessions
  } else if (!isNewSession && client_id) {
      // É uma sessão existente, mas por algum motivo enviaram client_id de novo. Ignoramos.
      console.warn(`Client_id (${client_id}) enviado para sessão EXISTENTE (${current_session_id}). Será ignorado para inserção na tabela 'sessions'.`);
  }

  try {
    // 1. Obtém o prompt do sistema
    const finalSystemPrompt = getSystemPrompt(role);
    console.log(`Enviando para OpenAI (Role: ${role}). Prompt System (início): ${finalSystemPrompt.substring(0, 100)}...`);

    // 2. Faz a chamada para a API da OpenAI (sem mudanças aqui)
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
         timeout: 90000 // 90s
       }
     );
    console.log(`Resposta recebida da OpenAI (Role: ${role}). Status: ${response.status}`);

    // <<< MUDANÇA 4: Inserção na tabela SESSIONS se for nova sessão E tiver client_id >>>
    if (isNewSession && client_id) {
        try {
            // Validar se o cliente existe E pertence ao usuário logado (ou é sessão anônima?)
            // Por enquanto, vamos permitir associar a qualquer cliente existente se a sessão for anônima,
            // mas se for logado, o cliente DEVE pertencer ao usuário.
            let clientCheck = null;
            if (effective_user_id !== 'anon') {
                 clientCheck = db.prepare('SELECT client_id FROM clients WHERE client_id = ? AND user_id = ?').get(client_id, effective_user_id);
                 if (!clientCheck) {
                    // Cliente não encontrado OU não pertence a este usuário! Retorna erro.
                    console.error(`Erro ao registrar sessão: Cliente ${client_id} não encontrado ou não pertence ao usuário ${effective_user_id}`);
                    return res.status(404).json({ error: `Cliente com ID ${client_id} não encontrado ou acesso negado.` });
                 }
                 console.log(`Validação OK: Cliente ${client_id} pertence ao usuário ${effective_user_id}.`);
            } else {
                 // Sessão anônima - Apenas verifica se o cliente existe
                 clientCheck = db.prepare('SELECT client_id FROM clients WHERE client_id = ?').get(client_id);
                 if (!clientCheck) {
                     console.error(`Erro ao registrar sessão anônima: Cliente ${client_id} não encontrado.`);
                     return res.status(404).json({ error: `Cliente com ID ${client_id} não encontrado.` });
                 }
                 console.log(`Validação OK: Cliente ${client_id} existe (sessão anônima).`);
            }


            // Cliente validado, insere na tabela sessions
            const sessionStmt = db.prepare(`
                INSERT INTO sessions (session_id, user_id, client_id, last_updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `);
            sessionStmt.run(current_session_id, effective_user_id, client_id);
            console.log(`Registro criado na tabela 'sessions' para session_id: ${current_session_id}, client_id: ${client_id}, user_id: ${effective_user_id}`);

        } catch (sessionDbError) {
            console.error(`ERRO AO REGISTRAR SESSÃO na tabela 'sessions' (session: ${current_session_id}, client: ${client_id}, user: ${effective_user_id}):`, sessionDbError);
            // Se erro for constraint (PK duplicada, FK inválida), retorna 409 ou 500?
            if (sessionDbError.code?.startsWith('SQLITE_CONSTRAINT')) {
                 // Pode ser session_id duplicado (improvável com timestamp) ou FK inválida (se cliente foi deletado entre a validação e o insert)
                 return res.status(409).json({ error: "Erro ao registrar sessão devido a dados inconsistentes ou conflitantes." });
             }
            // Outros erros, retorna 500
            return res.status(500).json({ error: "Erro interno ao registrar a sessão no banco de dados." });
        }
    }

    // 4. Lógica de Salvamento do Histórico (session_history) - (sem mudanças significativas aqui, mas verificando contexto)
    let reply = ''; // Inicializa reply
    if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
      reply = response.data.choices[0].message.content.trim();
      try {
        const row = db.prepare('SELECT history FROM session_history WHERE session_id = ?').get(current_session_id);
        let currentHistory = [];
        if (row && row.history) {
            try {
                currentHistory = JSON.parse(row.history);
                if (!Array.isArray(currentHistory)) currentHistory = []; // Garante que seja array
            } catch (parseError) {
                console.error(`Erro ao parsear histórico existente para sessão ${current_session_id}. Resetando histórico local.`, parseError);
                currentHistory = []; // Reseta se JSON inválido
            }
        }

        const interaction = { type: 'user_message_to_bot', role_called: role, content: message, timestamp: new Date().toISOString() };
        const botResponse = { type: 'bot_response', role: role, content: reply, timestamp: new Date().toISOString() };
        const updatedHistory = [...currentHistory, interaction, botResponse];

        // Salva na session_history
        db.prepare('INSERT OR REPLACE INTO session_history (session_id, user_id, history) VALUES (?, ?, ?)').run(
          current_session_id, effective_user_id, JSON.stringify(updatedHistory)
        );
        console.log(`Histórico salvo/atualizado para session_id: ${current_session_id}, effective_user_id: ${effective_user_id}`);

        // <<< MUDANÇA 5: Atualiza last_updated_at na tabela sessions se a sessão existir lá >>>
        // Se a sessão foi criada neste request (isNewSession && client_id) OU
        // se é uma sessão existente (!isNewSession) que *poderia* estar na tabela sessions
        // (Não temos como saber com certeza se uma sessão antiga está vinculada sem buscar,
        // então tentamos o UPDATE. Se não existir, não fará nada)
        try {
             db.prepare('UPDATE sessions SET last_updated_at = CURRENT_TIMESTAMP WHERE session_id = ?')
               .run(current_session_id);
             // Não precisamos logar sucesso aqui, só erro.
         } catch (updateErr) {
             // Loga o erro mas não impede a resposta principal
             console.error(`Erro (não crítico) ao atualizar last_updated_at para sessão ${current_session_id}:`, updateErr);
         }

      } catch (dbError) {
        console.error(`Erro CRÍTICO ao salvar histórico na tabela 'session_history' (session: ${current_session_id}, user: ${effective_user_id}):`, dbError);
        // Considerar retornar erro 500 aqui, pois a falha em salvar o histórico é crítica.
        return res.status(500).json({ error: "Erro interno ao salvar histórico da conversa." });
      }
    } else {
      console.warn(`Histórico não salvo (session: ${current_session_id}): Resposta da OpenAI inválida ou vazia.`, response.data);
      // Mesmo se a resposta for inválida, retorna sucesso parcial (status 200) mas sem o conteúdo da IA.
      // O frontend terá que lidar com uma resposta sem 'choices'.
      // Prepara uma resposta indicando a falha parcial.
      const partialFailureResponse = {
          warning: 'Resposta da IA não foi obtida ou veio em formato inesperado.',
          openai_response: response.data // Retorna a resposta crua da OpenAI para debug
      };
       if (isNewSession) {
           partialFailureResponse.generated_session_id = current_session_id;
       }
       // Retorna 200 OK, mas com um aviso. O histórico não foi salvo para esta interação.
       return res.status(200).json(partialFailureResponse);
    }

    // 5. Prepara e envia a resposta para o Frontend (sem mudanças aqui)
    const responseData = { ...response.data };
    // Garante que a resposta final tenha o conteúdo extraído (mesmo que vazio se a IA falhou antes)
    responseData.choices = [{ message: { content: reply } }]; // Formata para o frontend esperar isso
    if (isNewSession) { // Envia o session_id gerado APENAS se for uma nova sessão
      responseData.generated_session_id = current_session_id;
      console.log(`Novo session_id gerado e retornado: ${current_session_id}`);
    }
    res.json(responseData);

  } catch (error) { // Trata erros da chamada axios ou erros relançados do DB
    // ... (código do catch permanece o mesmo) ...
    let statusCode = 500;
    let errorMessage = 'Erro interno do servidor ao processar a requisição.';
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('Erro: Timeout na chamada para OpenAI.');
      statusCode = 504;
      errorMessage = 'O serviço de IA demorou muito para responder.';
    } else if (error.response) { // Erro da API OpenAI
      console.error(`Erro da API OpenAI: Status ${error.response.status}`, error.response.data);
      statusCode = error.response.status;
      errorMessage = error.response.data?.error?.message || `Erro ${statusCode} do serviço de IA.`;
      if (statusCode === 401) errorMessage = "Chave da API OpenAI inválida ou não autorizada.";
      if (statusCode === 429) errorMessage = "Limite de requisições da API OpenAI atingido.";
      if (statusCode === 400) errorMessage = "Requisição inválida para a API OpenAI.";
    } else if (error.request) { // Erro de rede
      console.error('Erro de rede ao chamar OpenAI (sem resposta):', error.message);
      statusCode = 504;
      errorMessage = 'Não foi possível conectar ao serviço de IA.';
    } else { // Outro erro (incluindo erros lançados explicitamente por nós, como validação de cliente)
      console.error('Erro interno não esperado ou validação falhou:', error.message, error.stack);
      // Se o erro já tiver um status code (como 404 da validação do cliente), usa ele.
      statusCode = error.statusCode || 500;
      errorMessage = error.message || `Erro inesperado no servidor.`;
    }
    // Verifica se a resposta já foi enviada (ex: erro de cliente não encontrado)
    if (!res.headersSent) {
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    } else {
        console.error("Tentativa de enviar resposta de erro após headers já terem sido enviados.");
    }
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

// Em backend/server.js, adicione este endpoint após os outros endpoints de /api/clients

// Endpoint para Listar Sessões de um Cliente Específico
app.get('/api/clients/:client_id/sessions', authenticateToken, (req, res) => {
  const { client_id } = req.params;
  const user = req.user; // Dados do usuário logado (do token)

  // 1. Garantir que o usuário está autenticado
  if (!user || !user.user_id) {
    return res.status(401).json({ error: "Autenticação necessária." });
  }
  const user_id = user.user_id;

  console.log(`Buscando sessões para client_id: ${client_id} e user_id: ${user_id}`);

  try {
    // 2. Verificar se o cliente pertence ao usuário logado
    const clientCheck = db.prepare('SELECT user_id FROM clients WHERE client_id = ?').get(client_id);

    if (!clientCheck) {
        console.warn(`Tentativa de acesso a sessões de cliente inexistente: ${client_id} por user: ${user_id}`);
        return res.status(404).json({ error: "Cliente não encontrado." });
    }
    if (clientCheck.user_id !== user_id) {
        console.warn(`Tentativa de acesso negada: Cliente ${client_id} não pertence ao user: ${user_id}`);
        // Retorna 404 em vez de 403 para não vazar informação se o cliente existe mas pertence a outro
        return res.status(404).json({ error: "Cliente não encontrado ou acesso negado." });
    }

    // 3. Cliente pertence ao usuário, buscar as sessões
    const sessions = db.prepare(`
      SELECT session_id, created_at, last_updated_at, title
      FROM sessions
      WHERE client_id = ? AND user_id = ?
      ORDER BY last_updated_at DESC
    `).all(client_id, user_id);

    console.log(`Encontradas ${sessions.length} sessões para client_id: ${client_id}`);

    // 4. Retornar a lista de sessões (pode ser vazia)
    res.json({ sessions: sessions || [] });

  } catch (dbError) {
    console.error(`Erro de banco de dados ao buscar sessões para client_id ${client_id} (user: ${user_id}):`, dbError);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar sessões.' });
  }
}); // Fim do GET /api/clients/:client_id/sessions

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