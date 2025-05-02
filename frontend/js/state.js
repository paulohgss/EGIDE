// frontend/js/state.js (Versão Final Corrigida)

import { DEFAULT_LANGUAGE } from './config.js';

// Chave para usar no localStorage
export const SESSION_ID_STORAGE_KEY = 'egideCurrentSessionId';

// Estado inicial da aplicação
export let AppState = {
  currentLanguage: localStorage.getItem('language') || DEFAULT_LANGUAGE,
  currentTheme: localStorage.getItem('theme') || 'light', // Assumindo que theme.js também usa localStorage
  isLoading: false,
  logs: [], // Array para armazenar logs individuais { bot: string, texto: string }
  filtroAtual: 'ALL',
  historicoConversa: "", // Armazena todo o histórico como string para fácil envio
  ultimaMensagemSupervisor: "",
  aguardandoRespostaUsuario: false,
  currentSessionId: null, // Inicializa como null
};

/**
 * Reseta o estado relacionado a um caso específico, incluindo logs,
 * histórico, estado de espera e session ID (no estado e no localStorage).
 */
export function resetCaseState() {
  console.log("Resetando estado do caso...");
  AppState.logs = [];
  AppState.historicoConversa = "";
  AppState.ultimaMensagemSupervisor = "";
  AppState.aguardandoRespostaUsuario = false;
  AppState.currentSessionId = null; // Limpa o ID da sessão no estado
  localStorage.removeItem(SESSION_ID_STORAGE_KEY); // Limpa o ID salvo no localStorage
  console.log("Estado do caso resetado e session_id removido do localStorage.");
}

// Nota: Removi as definições duplicadas e a estrutura antiga com getters/setters.