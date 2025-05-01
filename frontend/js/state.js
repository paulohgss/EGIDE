// state.js - Gerenciamento do estado da aplicação

import { DEFAULT_LANGUAGE } from './config.js';

export const AppState = {
  _historicoConversa: "",
  _aguardandoRespostaUsuario: false,
  _ultimaMensagemSupervisor: "",
  _logs: [],
  _filtroAtual: "ALL",
  _currentLanguage: localStorage.getItem('language') || DEFAULT_LANGUAGE,
  _currentSessionId: null, // <<< NOVO: Para armazenar o ID da sessão atual

  // Getters e Setters
  

  get historicoConversa() { return this._historicoConversa; },
  set historicoConversa(value) { this._historicoConversa = value; },

  get aguardandoRespostaUsuario() { return this._aguardandoRespostaUsuario; },
  set aguardandoRespostaUsuario(value) { this._aguardandoRespostaUsuario = value; },

  get ultimaMensagemSupervisor() { return this._ultimaMensagemSupervisor; },
  set ultimaMensagemSupervisor(value) { this._ultimaMensagemSupervisor = value; },

  get logs() { return this._logs; },
  addLog(logEntry) { this._logs.push(logEntry); },
  clearLogs() { this._logs = []; this._historicoConversa = ""; this._currentSessionId = null; /* Limpa session ID também */},

  get filtroAtual() { return this._filtroAtual; },
  set filtroAtual(value) { this._filtroAtual = value; },

  get currentLanguage() { return this._currentLanguage; },
  set currentLanguage(value) {
      this._currentLanguage = value;
      localStorage.setItem('language', value);
  },

  // <<< NOVO: Getter e Setter para Session ID >>>
  get currentSessionId() { return this._currentSessionId; },
  set currentSessionId(value) { this._currentSessionId = value; },
};

// Função para resetar partes do estado para um novo caso
export function resetCaseState() {
  AppState.aguardandoRespostaUsuario = false;
  AppState.ultimaMensagemSupervisor = "";
  AppState.clearLogs(); // Limpa logs, histórico e session ID
}