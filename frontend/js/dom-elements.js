// dom-elements.js - Seletores do DOM centralizados

export const DOM = {
  body: document.body,
  languageSelect: document.getElementById('languageSelect'),
  themeToggle: document.getElementById('themeToggle'),
  caseForm: document.getElementById('caseForm'),
  entradaUsuario: document.getElementById('entradaUsuario'),
  errorMessage: document.getElementById('errorMessage'),
  submitButton: document.getElementById('submitButton'),
  submitSpinner: document.querySelector('#submitButton .loading-spinner'),
  manualActionButtons: document.querySelectorAll('[data-bot-role]'), // Para ações manuais
  respostaFinal: document.getElementById('respostaFinal'),
  filterSelect: document.getElementById('filterSelect'),
  clearLogsBtn: document.getElementById('clearLogsBtn'),
  exportLogsBtn: document.getElementById('exportLogsBtn'),
  logsIndividuais: document.getElementById('logsIndividuais'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  respostaUsuarioBox: document.getElementById('respostaUsuarioBox'),
  respostaUsuarioInput: document.getElementById('respostaUsuarioInput'),
  respondSupervisorBtn: document.getElementById('respondSupervisorBtn'),

  // Agrupamento para facilitar atualização de i18n
  i18nElements: {
    title: document.getElementById('title'),
    caseLabel: document.getElementById('caseLabel'),
    caseHelp: document.getElementById('caseHelp'),
    submitText: document.getElementById('submitText'),
    manualActions: document.getElementById('manualActions'),
    manualRedator: document.getElementById('manualRedator'), // Botão inteiro
    manualMedico: document.getElementById('manualMedico'),
    manualEstrategista: document.getElementById('manualEstrategista'),
    manualSupervisor: document.getElementById('manualSupervisor'),
    clearLogs: document.getElementById('clearLogs'), // Span dentro do botão
    exportLogs: document.getElementById('exportLogs'), // Span dentro do botão
    filterLabel: document.getElementById('filterLabel'),
    filterAll: document.getElementById('filterAll'), // Option dentro do select
    downloadPdf: document.getElementById('downloadPdf'), // Span dentro do botão
    supervisorRequest: document.getElementById('supervisorRequest'), // Título da caixa
    responseHelp: document.getElementById('responseHelp'), // Texto de ajuda do input
    respondSupervisor: document.getElementById('respondSupervisor'), // Span dentro do botão
  }
};