// frontend/js/client-sessions.js
import { getClientAttendances, getAttendanceSessions, fetchAttendance } from './api.js';
import { SESSION_ID_STORAGE_KEY } from './state.js';
import { initializeI18n, i18nInstance, getT } from './i18n.js';
import { DOM, initializeDOM } from './dom-elements.js';

const pageTitle = document.getElementById('page-title');
const loadingIndicator = document.getElementById('sessions-loading');
const errorIndicator = document.getElementById('sessions-error');
const noSessionsMessage = document.getElementById('sessions-message');
const messageDiv = document.getElementById('sessions-message');
const accordion = document.getElementById('attendances-accordion');
const addAttendanceButton = document.getElementById('add-attendance-button');

function showPageError(message) {
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.classList.remove('d-none', 'alert-success');
        messageDiv.classList.add('alert-danger');
    }
}

function clearPageError() {
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.classList.add('d-none');
    }
}

function showTranslatedError(key, fallback) {
    const t = getT();
    showPageError(t(key, fallback));
}

function toggleTableStatus(status) {
    console.log(`[toggleTableStatus] Setting status to: ${status}`);
    loadingIndicator?.classList.toggle('d-none', status !== 'loading');
    errorIndicator?.classList.toggle('d-none', status !== 'error');
    noSessionsMessage?.classList.toggle('d-none', status !== 'no-data');
    accordion?.classList.toggle('d-none', status !== 'has-data');
    console.log(`[toggleTableStatus] Loading hidden: ${loadingIndicator?.classList.contains('d-none')}`);
    console.log(`[toggleTableStatus] Accordion hidden: ${accordion?.classList.contains('d-none')}`);

    if (status !== 'has-data' && accordion) {
        accordion.innerHTML = '';
    }
    if (status !== 'error' && errorIndicator) {
        errorIndicator.textContent = '';
    }
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString('pt-BR');
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

async function fetchAndRenderClientAttendances(clientId, clientName) {
    clearPageError();
    toggleTableStatus('loading');
    try {
        console.log("[fetchAndRenderClientAttendances] Calling getClientAttendances...");
        const attendanceData = await getClientAttendances(clientId);
        console.log("[fetchAndRenderClientAttendances] Received attendance data:", attendanceData);

        const attendances = attendanceData?.attendances || [];
        if (!Array.isArray(attendances)) {
            console.error("[fetchAndRenderClientAttendances] Erro: API não retornou um array de atendimentos.", attendances);
            throw new Error("Formato de resposta inválido da API.");
        }

        if (!accordion) {
            console.warn("Elemento #attendances-accordion não encontrado. Não será possível exibir atendimentos.");
            return;
        }

        const t = getT();
        if (attendances.length === 0) {
            console.log("[fetchAndRenderClientAttendances] No attendances found. Setting status to 'no-data'.");
            toggleTableStatus('no-data');
            if (noSessionsMessage) {
                noSessionsMessage.textContent = t('noAttendances', 'Nenhum atendimento encontrado para este cliente.');
            }
        } else {
            console.log("[fetchAndRenderClientAttendances] Attendances found. Setting status to 'has-data'.");
            toggleTableStatus('has-data');
            accordion.innerHTML = '';
            accordion.classList.remove('d-none');
            attendances.forEach((attendance, index) => {
                if (!attendance) {
                    console.warn(`Pulando atendimento NULO no índice ${index}`);
                    return;
                }
                const accordionItem = document.createElement('div');
                accordionItem.className = 'accordion-item';
                accordionItem.innerHTML = `
                    <h2 class="accordion-header" id="heading-${index}">
                        <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}" aria-expanded="${index === 0}" aria-controls="collapse-${index}">
                            ${t('attendance', 'Atendimento')} ${index + 1} - ${formatTimestamp(attendance.last_updated_at)}
                        </button>
                    </h2>
                    <div id="collapse-${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" aria-labelledby="heading-${index}" data-bs-parent="#attendances-accordion">
                        <div class="accordion-body">
                            <p><strong>${t('description', 'Descrição')}:</strong> ${escapeHtml(attendance.description)}</p>
                            <div class="mb-2">
                                <button class="btn btn-sm btn-primary start-analysis-btn" data-attendance-id="${escapeHtml(attendance.attendance_id)}">${t('startAnalysis', 'Iniciar Análise')}</button>
                            </div>
                            <div id="sessions-${index}" class="sessions-list">
                                <div class="text-center">
                                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                                        <span class="visually-hidden">${t('loading', 'Carregando...')}</span>
                                    </div>
                                    <p>${t('loadingSessions', 'Carregando sessões...')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                accordion.appendChild(accordionItem);
                fetchSessionsForAttendance(attendance.attendance_id, index);
            });
        }
    } catch (error) {
        console.error("[fetchAndRenderClientAttendances] Erro ao buscar/renderizar atendimentos:", error, error.stack);
        if (errorIndicator) {
            const t = getT();
            errorIndicator.textContent = t('errorFetchingClientAttendances', 'Erro ao carregar os atendimentos: ') + error.message;
        }
        toggleTableStatus('error');
    }
}

async function fetchSessionsForAttendance(attendanceId, index) {
    const sessionList = document.getElementById(`sessions-${index}`);
    try {
        const data = await getAttendanceSessions(attendanceId);
        const sessions = data.sessions || [];
        const t = getT();
        if (sessions.length === 0) {
            sessionList.innerHTML = `<p class="text-muted">${t('noSessionsForAttendance', 'Nenhuma sessão de análise para este atendimento.')}</p>`;
        } else {
            sessionList.innerHTML = `
                <h6>${t('analysisSessions', 'Sessões de Análise')}:</h6>
                <ul class="list-group">
                    ${sessions.map(session => `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <span>${t('session', 'Sessão')} ${formatTimestamp(session.last_updated_at)}</span>
                            <button class="btn btn-sm btn-primary load-session-btn" data-session-id="${escapeHtml(session.session_id)}">${t('loadAnalysis', 'Carregar Análise')}</button>
                        </li>
                    `).join('')}
                </ul>
            `;
        }
    } catch (error) {
        console.error(`Erro ao buscar sessões para atendimento ${attendanceId}:`, error);
        const t = getT();
        sessionList.innerHTML = `<p class="text-danger">${t('errorFetchingSessions', 'Erro ao carregar sessões.')}</p>`;
    }
}

function handleLoadSession(event, sessionId) {
    if (!sessionId) {
        console.error("handleLoadSession chamado sem sessionId.");
        showTranslatedError('errorSessionNotFound', 'Erro ao obter ID da sessão.');
        return;
    }
    console.log(`Tentando carregar sessão ID: ${sessionId}`);

    const loadSessionButton = event.target.closest('.load-session-btn');
    if (loadSessionButton) {
        loadSessionButton.disabled = true;
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm me-2';
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-hidden', 'true');
        loadSessionButton.prepend(spinner);
        loadSessionButton.querySelector('span:not(.spinner-border)')?.remove();
        const loadingText = document.createElement('span');
        const t = getT();
        loadingText.textContent = t('loading', 'Carregando...');
        loadSessionButton.appendChild(loadingText);
    }

    sessionStorage.removeItem('selectedClientId');
    sessionStorage.removeItem('selectedClientName');
    sessionStorage.removeItem('selectedAttendanceId');
    sessionStorage.removeItem('selectedAttendanceDescription');
    localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
    sessionStorage.setItem('cameFrom', 'client-sessions');

    const urlParams = new URLSearchParams(window.location.search);
    const clientIdFromUrl = urlParams.get('clientId');
    const clientNameFromUrl = urlParams.get('clientName');
    if (clientIdFromUrl) sessionStorage.setItem('cameFromClientId', clientIdFromUrl);
    if (clientNameFromUrl) sessionStorage.setItem('cameFromClientName', clientNameFromUrl);

    setTimeout(() => {
        window.location.href = 'chat.html';
    }, 500);
}

function handleStartAnalysis(event, attendanceId) {
    if (!attendanceId) {
        console.error("handleStartAnalysis chamado sem attendanceId.");
        showTranslatedError('attendanceIdNotProvided', 'ID do atendimento não fornecido.');
        return;
    }
    console.log(`Iniciando análise para atendimento ID: ${attendanceId}`);

    const startAnalysisButton = event.target.closest('.start-analysis-btn');
    if (startAnalysisButton) {
        startAnalysisButton.disabled = true;
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm me-2';
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-hidden', 'true');
        startAnalysisButton.prepend(spinner);
        startAnalysisButton.querySelector('span:not(.spinner-border)')?.remove();
        const loadingText = document.createElement('span');
        const t = getT();
        loadingText.textContent = t('loading', 'Carregando...');
        startAnalysisButton.appendChild(loadingText);
    }

    fetchAttendance(attendanceId).then(attendance => {
        if (!attendance) {
            const t = getT();
            showTranslatedError('attendanceNotFound', 'Atendimento não encontrado.');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const clientId = urlParams.get('clientId');
        const clientName = urlParams.get('clientName') || 'Cliente';

        sessionStorage.setItem('selectedClientId', clientId);
        sessionStorage.setItem('selectedClientName', clientName);
        sessionStorage.setItem('selectedAttendanceId', attendanceId);
        sessionStorage.setItem('selectedAttendanceDescription', attendance.description);
        localStorage.removeItem(SESSION_ID_STORAGE_KEY);

        sessionStorage.setItem('cameFrom', 'client-sessions');
        if (clientId) sessionStorage.setItem('cameFromClientId', clientId);
        if (clientName) sessionStorage.setItem('cameFromClientName', clientName);

        setTimeout(() => {
            window.location.href = 'chat.html';
        }, 500);
    }).catch(error => {
        console.error("Erro ao buscar atendimento:", error);
        const t = getT();
        showPageError(t('errorLoadingAttendance', 'Erro ao carregar o atendimento: ') + error.message);
    });
}

function handleNewAnalysis(clientId, clientName) {
    console.log(`Iniciando nova análise para cliente ID: ${clientId}, Nome: ${clientName}`);

    const newAnalysisButton = document.getElementById('new-analysis-button');
    if (newAnalysisButton) {
        newAnalysisButton.disabled = true;
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm me-2';
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-hidden', 'true');
        newAnalysisButton.prepend(spinner);
        newAnalysisButton.querySelector('span:not(.spinner-border)')?.remove();
        const loadingText = document.createElement('span');
        const t = getT();
        loadingText.textContent = t('loading', 'Carregando...');
        newAnalysisButton.appendChild(loadingText);
    }

    sessionStorage.setItem('selectedClientId', clientId);
    sessionStorage.setItem('selectedClientName', clientName);
    localStorage.removeItem(SESSION_ID_STORAGE_KEY);

    setTimeout(() => {
        window.location.href = 'chat.html';
    }, 500);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('client-sessions.js: Iniciando carregamento da página.');

    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('client-sessions.js: Token não encontrado. Redirecionando para login.');
        window.location.href = 'login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId');
    const clientName = urlParams.get('clientName') || 'Cliente';

    try {
        console.log('client-sessions.js: Inicializando DOM...');
        initializeDOM();

        // Validação mais robusta do DOM
        const missingElements = [];
        if (!accordion) missingElements.push('attendances-accordion');
        if (!pageTitle) missingElements.push('page-title');
        if (!addAttendanceButton) missingElements.push('add-attendance-button');
        if (missingElements.length > 0) {
            console.error('client-sessions.js: Elementos do DOM ausentes:', {
                accordion: !!accordion,
                pageTitle: !!pageTitle,
                addAttendanceButton: !!addAttendanceButton
            });
            showPageError('Erro: Os seguintes elementos estão ausentes no DOM: ' + missingElements.join(', '));
            toggleTableStatus('error');
            return;
        }

        console.log('client-sessions.js: Inicializando i18n...');
        await initializeI18n();
        if (!i18nInstance || typeof i18nInstance.t !== 'function') {
            console.error('client-sessions.js: i18next não inicializado corretamente.');
            throw new Error('i18next não está inicializado corretamente.');
        }

        if (pageTitle && clientId) {
            const safeClientName = clientName || 'Cliente';
            pageTitle.textContent = `${i18nInstance.t('attendanceHistory', 'Histórico de Atendimentos')} - ${escapeHtml(safeClientName)}`;
        } else if (!clientId) {
            console.error("client-sessions.js: clientId não encontrado nos parâmetros da URL.");
            showTranslatedError('errorClientNotFound', 'Erro: ID do cliente não especificado na URL.');
            toggleTableStatus('error');
            if (errorIndicator) {
                const t = getT();
                errorIndicator.textContent = t('errorClientNotFound', 'ID do cliente não encontrado na URL.');
            }
            return;
        }

        // Configurar traduções dinâmicas
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = i18nInstance.t(key, key);
        });

        // Configurar botão "Adicionar Atendimento"
        addAttendanceButton.href = `add-attendance.html?clientId=${encodeURIComponent(clientId)}&clientName=${encodeURIComponent(clientName)}`;
        console.log(`client-sessions.js: Botão 'Adicionar Atendimento' configurado para: ${addAttendanceButton.href}`);

        fetchAndRenderClientAttendances(clientId, clientName);

        accordion.addEventListener('click', (event) => {
            const startAnalysisButton = event.target.closest('.start-analysis-btn');
            const loadSessionButton = event.target.closest('.load-session-btn');
            if (startAnalysisButton) {
                const attendanceId = startAnalysisButton.dataset.attendanceId;
                console.log("client-sessions.js: Botão 'Iniciar Análise' clicado. ID do Atendimento:", attendanceId);
                handleStartAnalysis(event, attendanceId);
            } else if (loadSessionButton) {
                const sessionIdFromData = loadSessionButton.dataset.sessionId;
                console.log("client-sessions.js: Botão 'Carregar Análise' clicado. ID da Sessão:", sessionIdFromData);
                handleLoadSession(event, sessionIdFromData);
            }
        });
        console.log("client-sessions.js: Listener delegado adicionado ao accordion para botões 'Iniciar Análise' e 'Carregar Análise'.");

        const newAnalysisButton = document.getElementById('new-analysis-button');
        if (newAnalysisButton) {
            newAnalysisButton.addEventListener('click', () => {
                console.log("client-sessions.js: Botão 'Nova Análise' clicado.");
                handleNewAnalysis(clientId, clientName);
            });
            console.log("client-sessions.js: Listener adicionado ao botão 'Nova Análise'.");
        } else {
            console.warn("client-sessions.js: Botão 'new-analysis-button' não encontrado no DOM.");
        }

        console.log(`client-sessions.js: Página de histórico carregada para cliente: ${clientName} (ID: ${clientId})`);
    } catch (err) {
        console.error('client-sessions.js: Erro ao inicializar a página:', err, err.stack);
        console.error('client-sessions.js: Estado do i18nInstance:', i18nInstance);
        const t = getT();
        showPageError(t('errorI18nInit', 'Erro ao carregar configurações de idioma.'));
        toggleTableStatus('error');
        if (errorIndicator) {
            errorIndicator.textContent = t('errorI18nInit', 'Erro ao carregar configurações de idioma.');
        }
    }
});