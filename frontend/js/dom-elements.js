export const DOM = {
  body: null,
  languageSelect: null,
  themeToggle: null,
  caseForm: null,
  entradaUsuario: null,
  errorMessage: null,
  submitButton: null,
  submitSpinner: null,
  manualActionButtons: null,
  respostaFinal: null,
  filterSelect: null,
  clearLogsBtn: null,
  exportLogsBtn: null,
  logsIndividuais: null,
  downloadPdfBtn: null,
  respostaUsuarioBox: null,
  respostaUsuarioInput: null,
  respondSupervisorBtn: null,
  i18nElements: {
      title: null,
      caseLabel: null,
      caseHelp: null,
      submitText: null,
      manualActions: null,
      manualRedator: null,
      manualMedico: null,
      manualEstrategista: null,
      manualSupervisor: null,
      clearLogs: null,
      exportLogs: null,
      filterLabel: null,
      filterAll: null,
      downloadPdf: null,
      supervisorRequest: null,
      responseHelp: null,
      respondSupervisor: null,
  },

  // Método para inicializar os elementos
  initialize() {
      this.body = document.body;
      this.languageSelect = document.getElementById('languageSelect');
      this.themeToggle = document.getElementById('themeToggle');
      this.caseForm = document.getElementById('caseForm');
      this.entradaUsuario = document.getElementById('entradaUsuario');
      this.errorMessage = document.getElementById('errorMessage');
      this.submitButton = document.getElementById('submitButton');
      this.submitSpinner = document.querySelector('#submitButton .loading-spinner');
      this.manualActionButtons = document.querySelectorAll('[data-bot-role]');
      this.respostaFinal = document.getElementById('respostaFinal');
      this.filterSelect = document.getElementById('filterSelect');
      this.clearLogsBtn = document.getElementById('clearLogsBtn');
      this.exportLogsBtn = document.getElementById('exportLogsBtn');
      this.logsIndividuais = document.getElementById('logsIndividuais');
      this.downloadPdfBtn = document.getElementById('downloadPdfBtn');
      this.respostaUsuarioBox = document.getElementById('respostaUsuarioBox');
      this.respostaUsuarioInput = document.getElementById('respostaUsuarioInput');
      this.respondSupervisorBtn = document.getElementById('respondSupervisorBtn');

      this.i18nElements.title = document.getElementById('title');
      this.i18nElements.caseLabel = document.getElementById('caseLabel');
      this.i18nElements.caseHelp = document.getElementById('caseHelp');
      this.i18nElements.submitText = document.getElementById('submitText');
      this.i18nElements.manualActions = document.getElementById('manualActions');
      this.i18nElements.manualRedator = document.getElementById('manualRedator');
      this.i18nElements.manualMedico = document.getElementById('manualMedico');
      this.i18nElements.manualEstrategista = document.getElementById('manualEstrategista');
      this.i18nElements.manualSupervisor = document.getElementById('manualSupervisor');
      this.i18nElements.clearLogs = document.getElementById('clearLogs');
      this.i18nElements.exportLogs = document.getElementById('exportLogs');
      this.i18nElements.filterLabel = document.getElementById('filterLabel');
      this.i18nElements.filterAll = document.getElementById('filterAll');
      this.i18nElements.downloadPdf = document.getElementById('downloadPdf');
      this.i18nElements.supervisorRequest = document.getElementById('supervisorRequest');
      this.i18nElements.responseHelp = document.getElementById('responseHelp');
      this.i18nElements.respondSupervisor = document.getElementById('respondSupervisor');
  }
};