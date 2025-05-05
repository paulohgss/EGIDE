// backend/db.js
const path = require('path');
const Database = require('better-sqlite3');

// Define o caminho para o ficheiro da base de dados (na pasta backend)
const dbPath = path.join(__dirname, 'egide.db');

// Cria (ou abre) a base de dados
const db = new Database(dbPath, { verbose: console.log }); // 'verbose' ajuda a depurar
console.log(`Base de dados conectada em: ${dbPath}`);

// Otimização: Habilita o modo WAL (Write-Ahead Logging) para melhor concorrência
db.pragma('journal_mode = WAL');
console.log('Modo WAL habilitado.');

// Função para executar a criação das tabelas
function initializeDatabase() {
  console.log('Inicializando esquema da base de dados...');

  // Tabela de Utilizadores (Advogados Master e Assistentes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'assistant' CHECK(role IN ('master', 'assistant')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Tabela "users" verificada/criada.');

  // Tabela de Clientes
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      client_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL, -- ID do advogado 'master' responsável
      name TEXT NOT NULL,
      cpf TEXT UNIQUE, -- CPF pode ser nulo inicialmente, mas deve ser único se preenchido
      dob DATE,        -- Data de Nascimento (formato AAAA-MM-DD)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE -- Apaga clientes se o user for apagado
    );
  `);
  console.log('Tabela "clients" verificada/criada.');
  // Criar índice para user_id na tabela clients para otimizar buscas
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);`);

  // Tabela de Atendimentos
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendances (
      id TEXT PRIMARY KEY, -- ID único do atendimento
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL, -- ID do utilizador que registou o atendimento (pode ser master ou assistente?)
      description TEXT NOT NULL,
      purpose TEXT NOT NULL,
      purpose_detail TEXT, -- Detalhe se purpose for 'Outro'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE, -- Apaga atendimentos se o cliente for apagado
      FOREIGN KEY (user_id) REFERENCES users(user_id) -- Não apaga se o user for apagado, mantém o registo
    );
  `);
  console.log('Tabela "attendances" verificada/criada.');
  // Criar índices
  db.exec(`CREATE INDEX IF NOT EXISTS idx_attendances_client_id ON attendances(client_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_attendances_user_id ON attendances(user_id);`);

  // Tabela de Sessões de Análise da IA
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,       -- Quem iniciou a sessão
      client_id TEXT,              -- Cliente associado (opcional)
      attendance_id TEXT,          -- Atendimento associado (opcional)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL, -- Mantém a sessão se cliente for apagado
      FOREIGN KEY (attendance_id) REFERENCES attendances(id) ON DELETE SET NULL -- Mantém a sessão se atendimento for apagado
    );
  `);
  console.log('Tabela "sessions" verificada/criada.');
  // Criar índices
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_attendance_id ON sessions(attendance_id);`);


  // Tabela de Mensagens (Histórico das conversas da IA)
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL, -- 'user', 'redator', 'medico', 'estrategista', 'supervisor', 'system'?
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE -- Apaga mensagens se a sessão for apagada
    );
  `);
  console.log('Tabela "messages" verificada/criada.');
  // Criar índice
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);`);

  console.log('Esquema da base de dados inicializado com sucesso.');
}

// Chama a função de inicialização imediatamente ao carregar o módulo
initializeDatabase();

// Exporta a instância da base de dados para ser usada noutros módulos
module.exports = db;