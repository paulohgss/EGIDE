// frontend/js/config.js (Ajustado)

// Base URL da API (sem endpoint específico)
export const API_BASE_URL = 'http://localhost:3000/api'; // Atualizar para Render em produção

// URLs Completas (construídas a partir da base)
export const API_LOGIN_URL = `${API_BASE_URL}/login`;
export const API_REGISTER_URL = `${API_BASE_URL}/register`;
export const API_CALL_BOT_URL = `${API_BASE_URL}/call-bot`;
export const API_SESSIONS_URL = `${API_BASE_URL}/sessions`; // Para listar sessões (futuro)
export const API_SESSION_HISTORY_URL_BASE = `${API_BASE_URL}/session-history`; // Base para buscar histórico por ID
export const API_ASSISTANTS_URL = `${API_BASE_URL}/assistants`; // Para gerenciar assistentes
export const API_CLIENTS_URL = `${API_BASE_URL}/clients`;

// Configs da Aplicação
export const MODEL = "gpt-4o"; // Exemplo
export const ROLES = ["medico", "redator", "estrategista", "supervisor"];
export const KEYWORDS_INCAPACIDADE = ["doença", "queda", "lesão", "incapacidade", "acidente", "laudo", "perícia", "cid", "problema de saúde"];
export const REGEX_PEDIDO_INFO = /\[PEDIDO_INFO\]|preciso que o usuário|aguardo informação|informe/i; // Adicionado [PEDIDO_INFO]
export const BASE_PATH = 'bases/'; // Caminho para os arquivos de base (usado no backend)

// Configuração inicial de linguagem
export const DEFAULT_LANGUAGE = 'pt';
export const SUPPORTED_LANGUAGES = ['pt', 'en'];

// Configuração de debounce/throttle (opcional)
export const DEBOUNCE_DELAY = 250;