let DOM = {};

export function initializeDOM() {
    DOM = {
        body: document.body,
        languageSelect: document.getElementById('language-select'),
        themeToggle: document.getElementById('theme-toggle'),
        themeToggleIndex: document.getElementById('theme-toggle'), // Para index.html
        caseForm: document.getElementById('caseForm'),
        entradaUsuario: document.getElementById('entradaUsuario'),
        errorMessage: document.getElementById('error-message'),
        submitButton: document.getElementById('submitButton'),
        clearLogsBtn: document.getElementById('clearLogsBtn'),
        exportLogsBtn: document.getElementById('exportLogsBtn'),
        logsIndividuais: document.getElementById('logsIndividuais'),
        downloadPdfBtn: document.getElementById('downloadPdfBtn'),
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
        pageTitle: document.getElementById('page-title'),
        attendanceForm: document.getElementById('attendance-form'),
        attendanceDescription: document.getElementById('attendance-description'),
        attendanceMessage: document.getElementById('attendance-message'),
        backButton: document.getElementById('back-button'),
        toggleUser: document.getElementById('toggle-user'),
        clientPurpose: document.getElementById('clientPurpose'),
        clientPurposeDetail: document.getElementById('clientPurposeDetail'),
        i18nElements: {
            title: document.getElementById('title'),
            caseLabel: document.getElementById('caseLabel'),
            mainTitle: document.getElementById('main-title'),
        }
    };
    console.log("[initializeDOM] DOM inicializado:", {
        logsIndividuaisExists: !!DOM.logsIndividuais,
        bodyExists: !!DOM.body,
        userGreetingExists: !!DOM.userGreeting,
        recentClientsTableBodyExists: !!DOM.recentClientsTableBody,
        attendanceFormExists: !!DOM.attendanceForm,
        clientPurposeExists: !!DOM.clientPurpose,
        clientPurposeDetailExists: !!DOM.clientPurposeDetail
    });
    return DOM;
}

export { DOM };