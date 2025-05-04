// backend/server.js
require('dotenv').config(); // Carregar variáveis de ambiente
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

// Importar os roteadores
const authRouter = require('./routes/auth');
const clientsRouter = require('./routes/clients');
const botsRouter = require('./routes/bots');
const attendancesRouter = require('./routes/attendances');
const assistantsRouter = require('./routes/assistants'); // Assumindo que existe
const sessionsRouter = require('./routes/sessions'); // Assumindo que existe

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
console.log(`Servindo arquivos estáticos de: ${frontendPath}`);
app.use(express.static(frontendPath));

// Configurar as rotas
app.use('/api', authRouter);
app.use('/api', clientsRouter);
app.use('/api', assistantsRouter);
app.use('/api', botsRouter);
app.use('/api', sessionsRouter);
app.use('/api', attendancesRouter);

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ error: `Rota ${req.originalUrl} não encontrada.` });
});

// Inicialização do Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Égide rodando na porta ${PORT}`);
    console.log(`Acesse o frontend em: http://localhost:${PORT}`);
    if (!process.env.OPENAI_API_KEY) {
        console.warn("AVISO IMPORTANTE: Variável de ambiente OPENAI_API_KEY não definida!");
    }
    if (!process.env.JWT_SECRET) {
        console.warn("AVISO: Variável de ambiente JWT_SECRET não definida! Usando chave padrão insegura para JWT.");
    }
});