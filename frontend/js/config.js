// config.js - Configurações da Aplicação

// ⚠️ Chave de API no frontend é insegura! Mover para backend em produção.
// export const API_KEY = "lá ele";
export const API_URL = 'http://localhost:3000/api/call-bot'; // Atualizar para Render em produção
export const API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const MODEL = "gpt-4";
export const ROLES = ["medico", "redator", "estrategista", "supervisor"];
export const KEYWORDS_INCAPACIDADE = ["doença", "queda", "lesão", "incapacidade", "acidente", "laudo", "perícia", "cid", "problema de saúde"];
export const REGEX_PEDIDO_INFO = /preciso que o usuário|aguardo informação|informe/i;
export const BASE_PATH = 'bases/'; // Caminho para os arquivos de base

// Configuração inicial de linguagem
export const DEFAULT_LANGUAGE = 'pt';
export const SUPPORTED_LANGUAGES = ['pt', 'en'];

// Configuração de debounce/throttle (opcional, para eventos como resize/scroll se necessário)
export const DEBOUNCE_DELAY = 250;