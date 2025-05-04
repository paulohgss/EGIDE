// i18n.js

import { DEFAULT_LANGUAGE } from './config.js';
import { AppState } from './state.js';

// Inicializar i18nInstance assincronamente
let i18nInstance = null;

// Função para carregar i18next dinamicamente
async function loadI18next() {
    if (window.i18next) return window.i18next;
    try {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/i18next@23.11.5/dist/umd/i18next.min.js';
        script.onerror = async () => {
            console.warn('Falha ao carregar i18next do CDN. Tentando fallback local.');
            try {
                const response = await fetch('/js/i18next.min.js');
                if (!response.ok) {
                    throw new Error('Falha ao carregar i18next local: ' + response.statusText);
                }
                const fallbackScript = document.createElement('script');
                fallbackScript.text = await response.text();
                document.head.appendChild(fallbackScript);
            } catch (err) {
                throw new Error('Falha no fallback local: ' + err.message);
            }
        };
        document.head.appendChild(script);
        return Promise.race([
            new Promise((resolve, reject) => {
                script.onload = () => window.i18next ? resolve(window.i18next) : reject(new Error('i18next não definido.'));
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao carregar i18next')), 5000))
        ]);
    } catch (err) {
        console.error('Erro ao carregar i18next:', err);
        throw new Error('Falha ao carregar i18next: ' + err.message);
    }
}

// Função para inicializar i18nInstance
async function initI18next() {
    try {
        i18nInstance = await loadI18next();
        console.log('i18next carregado com sucesso.');
    } catch (err) {
        console.error('Erro ao inicializar i18next:', err);
        throw err;
    }
}

const resources = {
    pt: {
        translation: {
            // client-sessions.js
            attendanceHistory: "Histórico de Atendimentos",
            noAttendances: "Nenhum atendimento encontrado para este cliente.",
            errorFetchingClientAttendances: "Erro ao carregar os atendimentos.",
            attendance: "Atendimento",
            description: "Descrição",
            startAnalysis: "Iniciar Análise",
            loading: "Carregando...",
            loadingSessions: "Carregando sessões...",
            noSessionsForAttendance: "Nenhuma sessão de análise para este atendimento.",
            analysisSessions: "Sessões de Análise",
            session: "Sessão",
            loadAnalysis: "Carregar Análise",
            errorFetchingSessions: "Erro ao carregar sessões.",
            previousAttendances: "Atendimentos Anteriores",
            loadingHistory: "Carregando histórico...",
            attendanceNotFound: "Atendimento não encontrado.",
            errorLoadingAttendance: "Erro ao carregar o atendimento: ",
            errorClientNotFound: "Erro: ID do cliente não especificado na URL.",
            errorI18nInit: "Erro ao carregar configurações de idioma.",
            backToClients: "Voltar para Clientes",
            addAttendance: "Adicionar Atendimento",

            // api.js
            authTokenNotFound: "Token de autenticação não encontrado.",
            errorFetchingClientAttendancesStatus: "Erro {{status}} ao buscar atendimentos.",
            errorAddingAttendance: "Erro ao adicionar atendimento: ",
            errorAddingAttendanceStatus: "Erro {{status}} ao adicionar atendimento.",

            // add-attendance.js
            newAttendance: "Novo Atendimento",
            descriptionRequired: "A descrição do atendimento é obrigatória.",
            saving: "Salvando...",
            attendanceAddedSuccess: "Atendimento cadastrado com sucesso!",
            addAttendanceButton: "Cadastrar Atendimento",
            errorAppInit: "Erro ao carregar a página de atendimento.",

            // chat.js e logs.js
            chatTitle: "Chat de Análise",
            caseDetails: "Detalhes do Caso",
            chatMessages: "Mensagens",
            sendMessage: "Enviar",
            manualActions: "Ações Manuais",
            manualRedator: "Chamar Redator",
            manualMedico: "Chamar Médico",
            manualEstrategista: "Chamar Estratégista",
            manualSupervisor: "Chamar Supervisor",
            finalResponse: "Resposta Final",
            downloadPdf: "Baixar PDF",
            supervisorResponsePlaceholder: "Digite a informação solicitada aqui...",
            respondSupervisor: "Enviar Resposta",
            client: "Cliente",
            supervisorRequestingRedactor: "Solicitando relatório técnico ao Redator...",
            supervisorRequestingMedical: "Solicitando análise médica ao Médico...",
            supervisorRequestingStrategic: "Solicitando análise estratégica ao Estratégista...",
            supervisorRequestingFinalReport: "Solicitando relatório final ao Redator...",
            supervisorProvidingFinalResponse: "Supervisor fornecendo resposta final...",
            manualLogSuffix: "Manual",
            responseToSupervisorSuffix: "Resposta para Supervisor",
            errorCaseRequired: "Por favor, descreva o caso.",
            errorInputBlocked: "Responda à solicitação do supervisor antes de enviar um novo caso.",
            errorActionBlocked: "Responda ao supervisor antes de continuar.",
            errorSessionRequired: "Inicie ou recarregue uma análise primeiro.",
            errorHistoryRequired: "Execute uma análise primeiro para ter histórico.",
            errorResponseRequired: "Por favor, forneça a informação solicitada.",
            errorSessionNotFound: "Não foi possível carregar o histórico: {{message}}",
            errorCallingBot: "Erro ao chamar {{role}}: {{message}}",
            errorFetchingTechnicalReport: "Erro ao obter relatório técnico.",
            errorFetchingMedicalAnalysis: "Erro ao obter análise médica.",
            errorFetchingStrategicAnalysis: "Erro ao obter análise estratégica.",
            errorFetchingFinalReport: "Erro ao obter relatório final.",
            errorFetchingSupervisorResponse: "Erro ao obter resposta final do supervisor.",
            errorProcessingRequest: "Ocorreu um erro inesperado ao processar o caso.",
            sessionIdNotSet: "Falha ao obter/definir o ID da sessão após a primeira chamada API.",
            startAnalysisPlaceholder: "Iniciando análise para o cliente: {{clientName}}.\n\nDescreva o caso ou a pergunta inicial:",
            logout: "Sair",
            backToSessions: "Voltar para Sessões",
            redator: "Redator",
            medico: "Médico",
            estrategista: "Estrategista",
            supervisor: "Supervisor",
            purpose: "Proposito",
            purposeDetail: "Detalhes do Proposito",
        }
    },
    en: {
        translation: {
            // client-sessions.js
            attendanceHistory: "Attendance History",
            noAttendances: "No attendances found for this client.",
            errorFetchingClientAttendances: "Error loading attendances.",
            attendance: "Attendance",
            description: "Description",
            startAnalysis: "Start Analysis",
            loading: "Loading...",
            loadingSessions: "Loading sessions...",
            noSessionsForAttendance: "No analysis sessions for this attendance.",
            analysisSessions: "Analysis Sessions",
            session: "Session",
            loadAnalysis: "Load Analysis",
            errorFetchingSessions: "Error loading sessions.",
            previousAttendances: "Previous Attendances",
            loadingHistory: "Loading history...",
            attendanceNotFound: "Attendance not found.",
            errorLoadingAttendance: "Error loading attendance: ",
            errorClientNotFound: "Error: Client ID not specified in the URL.",
            errorI18nInit: "Error loading language settings.",
            backToClients: "Back to Clients",
            addAttendance: "Add Attendance",
            

            // api.js
            authTokenNotFound: "Authentication token not found.",
            errorFetchingClientAttendancesStatus: "Error {{status}} fetching attendances.",
            errorAddingAttendance: "Error adding attendance: ",
            errorAddingAttendanceStatus: "Error {{status}} adding attendance.",

            // add-attendance.js
            newAttendance: "New Attendance",
            descriptionRequired: "The attendance description is required.",
            saving: "Saving...",
            attendanceAddedSuccess: "Attendance added successfully!",
            addAttendanceButton: "Add Attendance",
            errorAppInit: "Error loading the attendance page.",

            // chat.js e logs.js
            chatTitle: "Analysis Chat",
            caseDetails: "Case Details",
            chatMessages: "Messages",
            sendMessage: "Send",
            manualActions: "Manual Actions",
            manualRedator: "Call Editor",
            manualMedico: "Call Doctor",
            manualEstrategista: "Call Strategist",
            manualSupervisor: "Call Supervisor",
            finalResponse: "Final Response",
            downloadPdf: "Download PDF",
            supervisorResponsePlaceholder: "Enter the requested information here...",
            respondSupervisor: "Send Response",
            client: "Client",
            supervisorRequestingRedactor: "Requesting technical report from Editor...",
            supervisorRequestingMedical: "Requesting medical analysis from Doctor...",
            supervisorRequestingStrategic: "Requesting strategic analysis from Strategist...",
            supervisorRequestingFinalReport: "Requesting final report from Editor...",
            supervisorProvidingFinalResponse: "Supervisor providing final response...",
            manualLogSuffix: "Manual",
            responseToSupervisorSuffix: "Response to Supervisor",
            errorCaseRequired: "Please describe the case.",
            errorInputBlocked: "Respond to the supervisor's request before sending a new case.",
            errorActionBlocked: "Respond to the supervisor before continuing.",
            errorSessionRequired: "Start or reload an analysis first.",
            errorHistoryRequired: "Run an analysis first to have history.",
            errorResponseRequired: "Please provide the requested information.",
            errorSessionNotFound: "Could not load history: {{message}}",
            errorCallingBot: "Error calling {{role}}: {{message}}",
            errorFetchingTechnicalReport: "Error fetching technical report.",
            errorFetchingMedicalAnalysis: "Error fetching medical analysis.",
            errorFetchingStrategicAnalysis: "Error fetching strategic analysis.",
            errorFetchingFinalReport: "Error fetching final report.",
            errorFetchingSupervisorResponse: "Error fetching final supervisor response.",
            errorProcessingRequest: "An unexpected error occurred while processing the case.",
            sessionIdNotSet: "Failed to obtain/set session ID after the first API call.",
            startAnalysisPlaceholder: "Starting analysis for client: {{clientName}}.\n\nDescribe the case or initial question:",
            logout: "Logout",
            backToSessions: "Back to Sessions",
            redator: "Editor",
            medico: "Doctor",
            estrategista: "Strategist",
            supervisor: "Supervisor"
        }
    }
};

async function initializeI18n() {
    await initI18next();
    return new Promise((resolve, reject) => {
        if (!i18nInstance || typeof i18nInstance.init !== 'function') {
            const err = new Error('i18next não está inicializado corretamente. Certifique-se de que a biblioteca foi carregada.');
            console.error(err.message);
            return reject(err);
        }
        i18nInstance.init({
            lng: AppState.currentLanguage || DEFAULT_LANGUAGE,
            fallbackLng: DEFAULT_LANGUAGE,
            resources,
            debug: false
        }, (err, t) => {
            if (err) {
                console.error('Falha na inicialização do i18next:', err);
                return reject(err);
            }
            console.log('i18next inicializado com sucesso.');
            resolve(t);
        });
    });
}

function updateContent(DOM) {
    const t = getT();
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key, key);
    });
    if (DOM && DOM.pageTitle) {
        const urlParams = new URLSearchParams(window.location.search);
        const clientName = urlParams.get('clientName') || 'Cliente';
        DOM.pageTitle.textContent = `${t('addAttendance', 'Adicionar Atendimento')} - ${escapeHtml(clientName)}`;
    }
}

function getT() {
    if (!i18nInstance || typeof i18nInstance.t !== 'function') {
        console.warn('i18nInstance não está pronto. Usando função de tradução padrão.');
        return (key, fallback) => fallback;
    }
    return i18nInstance.t.bind(i18nInstance);
}

function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe)
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "")
        .replace(/'/g, "'");
}

function getBotLogPrefix(role) {
    const t = getT();
    switch (role) {
        case 'redator':
            return `[${t('redator', 'Redator')}]`;
        case 'medico':
            return `[${t('medico', 'Médico')}]`;
        case 'estrategista':
            return `[${t('estrategista', 'Estrategista')}]`;
        case 'supervisor':
            return `[${t('supervisor', 'Supervisor')}]`;
        default:
            return `[${role}]`;
    }
}

// Exportar funções e variáveis
export { initializeI18n, updateContent, i18nInstance, getT, escapeHtml, getBotLogPrefix };