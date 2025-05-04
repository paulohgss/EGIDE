// frontend/js/dom-elements.js
let DOM = {};

export function initializeDOM() {
    DOM = {
        body: document.body,
        languageSelect: document.getElementById('languageSelect'),
        themeToggle: document.getElementById('themeToggle'), // Para chat.html
        themeToggleIndex: document.getElementById('theme-toggle'), // Para index.html
        caseForm: document.getElementById('caseForm'),
        entradaUsuario: document.getElementById('entradaUsuario'),
        errorMessage: document.getElementById('errorMessage'),
        submitButton: document.getElementById('submitButton'),
        submitSpinner: document.querySelector('#submitButton .loading-spinner'),
        manualActionButtons: document.querySelectorAll('[data-bot-role]'),
        respostaFinal: document.getElementById('respostaFinal'),
        filterSelect: document.getElementById('filterSelect'),
        clearLogsBtn: document.getElementById('clearLogsBtn'),
        exportLogsBtn: document.getElementById('exportLogsBtn'),
        logsIndividuais: document.getElementById('logsIndividuais'),
        downloadPdfBtn: document.getElementById('downloadPdfBtn'),
        respostaUsuarioBox: document.getElementById('respostaUsuarioBox'),
        respostaUsuarioInput: document.getElementById('respostaUsuarioInput'),
        respondSupervisorBtn: document.getElementById('respondSupervisorBtn'),
        // Seletores para index.html
        userGreeting: document.getElementById('user-greeting'),
        logoutLink: document.getElementById('logout-link'),
        notificationsList: document.getElementById('notifications-list'),
        clientsLoading: document.getElementById('clients-loading'),
        clientsError: document.getElementById('clients-error'),
        recentClientsTableBody: document.getElementById('recent-clients-table-body'),
        noClientsMessage: document.getElementById('no-clients-message'),
        assistantsSummary: document.getElementById('assistants-summary'),
        assistantsCount: document.getElementById('assistants-count'),
        manageAssistantsCard: document.getElementById('manage-assistants-card'),
        // Seletores para add-attendance.html
        pageTitle: document.getElementById('page-title'),
        attendanceForm: document.getElementById('attendance-form'),
        attendanceDescription: document.getElementById('attendance-description'),
        attendanceMessage: document.getElementById('attendance-message'),
        backButton: document.getElementById('back-button'),
        // Elementos para traduções dinâmicas
        i18nElements: {
            title: document.getElementById('title'),
            caseLabel: document.getElementById('caseLabel'),
            caseHelp: document.getElementById('caseHelp'),
            submitText: document.getElementById('submitText'),
            manualActions: document.getElementById('manualActions'),
            manualRedator: document.getElementById('manualRedator'),
            manualMedico: document.getElementById('manualMedico'),
            manualEstrategista: document.getElementById('manualEstrategista'),
            manualSupervisor: document.getElementById('manualSupervisor'),
            clearLogs: document.getElementById('clearLogs'),
            exportLogs: document.getElementById('exportLogs'),
            filterLabel: document.getElementById('filterLabel'),
            filterAll: document.getElementById('filterAll'),
            downloadPdf: document.getElementById('downloadPdf'),
            supervisorRequest: document.getElementById('supervisorRequest'),
            responseHelp: document.getElementById('responseHelp'),
            respondSupervisor: document.getElementById('respondSupervisor'),
            mainTitle: document.getElementById('main-title'),
        }
    };
    console.log("[initializeDOM] DOM inicializado:", {
        logsIndividuaisExists: !!DOM.logsIndividuais,
        bodyExists: !!DOM.body,
        userGreetingExists: !!DOM.userGreeting,
        recentClientsTableBodyExists: !!DOM.recentClientsTableBody,
        attendanceFormExists: !!DOM.attendanceForm
    });
    return DOM;
}

export { DOM };