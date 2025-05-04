// frontend/js/state.js (Versão Final Corrigida)

import { DEFAULT_LANGUAGE } from './config.js';

// Chave para usar no localStorage
export const SESSION_ID_STORAGE_KEY = 'egideCurrentSessionId';

export let AppState = {
  currentLanguage: localStorage.getItem('language') || DEFAULT_LANGUAGE,
  logs: [],
  filtroAtual: 'ALL',
  historicoConversa: "",
  ultimaMensagemSupervisor: "",
  aguardandoRespostaUsuario: false,
  currentSessionId: null,
  pendingClientId: null, // Restaurado
  pendingClientName: null // Restaurado
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