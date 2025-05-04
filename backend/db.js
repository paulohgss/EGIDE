const Database = require('better-sqlite3');

const db = new Database('egide.db', { verbose: console.log });

// Ativar modo serializado
db.serialize();

try {
    // Criar tabela users
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'master',
            master_user_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("Tabela 'users' criada ou já existe.");

    // Criar tabela clients
    db.exec(`
        CREATE TABLE IF NOT EXISTS clients (
            client_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            cpf TEXT UNIQUE,
            dob TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    `);
    console.log("Tabela 'clients' criada ou já existe.");

    // Criar tabela attendances
    db.exec(`
        CREATE TABLE IF NOT EXISTS attendances (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(client_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    `);
    console.log("Tabela 'attendances' criada ou já existe.");

    // Criar tabela sessions
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            client_id TEXT,
            attendance_id TEXT,
            last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(client_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id),
            FOREIGN KEY (attendance_id) REFERENCES attendances(id)
        )
    `);
    console.log("Tabela 'sessions' criada ou já existe.");

    // Criar tabela session_history
    db.exec(`
        CREATE TABLE IF NOT EXISTS session_history (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            history TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    `);
    console.log("Tabela 'session_history' criada ou já existe.");
} catch (err) {
    console.error('Erro ao inicializar o banco de dados:', err.message, err.stack);
    process.exit(1);
}

module.exports = db;