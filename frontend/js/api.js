// API.JS

import {
    API_BASE_URL,
    API_CALL_BOT_URL,
    API_SESSION_HISTORY_URL_BASE,
    API_ASSISTANTS_URL,
    API_CLIENTS_URL,
} from './config.js';
import { AppState, SESSION_ID_STORAGE_KEY } from './state.js';
import { showError, showProgress, clearProgress } from './ui.js';
import { i18nInstance } from './i18n.js';
import { getT } from './i18n.js';

// --- Helpers ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getAuthToken() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('Token de autenticação não encontrado no localStorage.');
        throw new Error('Token de autenticação não encontrado.');
    }
    return token;
}

function createAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getAuthToken();
    headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// --- Funções da API ---

/**
 * Chama o backend para executar um bot.
 * @param {string} role - Papel do bot (ex.: 'redator').
 * @param {string} userMessage - Mensagem do usuário.
 * @param {string|null} session_id - ID da sessão (nulo para nova sessão).
 * @param {string|null} client_id - ID do cliente.
 * @param {string|null} attendance_id - ID do atendimento.
 * @param {number} retries - Número de tentativas.
 * @returns {Promise<string>} Resposta do bot.
 */
export async function callBotAPI(role, userMessage, session_id = null, client_id = null, attendance_id = null, retries = 3) {
    const effectiveUserId = localStorage.getItem('user_id');
    console.log('Iniciando callBotAPI:', {
        API_CALL_BOT_URL,
        role,
        userMessage: userMessage?.substring(0, 50) + '...',
        session_id,
        client_id,
        attendance_id,
        user_id: effectiveUserId,
        retries
    });

    try {
        // Validação de parâmetros
        if (!role || !userMessage) {
            console.error('Parâmetros obrigatórios ausentes:', { role, userMessage });
            throw new Error('Role e userMessage são obrigatórios.');
        }
        if (typeof retries !== 'number' || retries < 1) {
            console.error('Parâmetro retries inválido:', retries);
            throw new Error('Retries deve ser um número maior ou igual a 1.');
        }
        console.log('Parâmetros validados com sucesso');

        // Configuração do i18n
        const isI18nReady = i18nInstance && typeof i18nInstance.t === 'function';
        console.log('i18nInstance está pronto:', isI18nReady);
        const t = isI18nReady ? i18nInstance.t.bind(i18nInstance) : (key, fallback) => fallback;

        // Chamada ao showProgress
        showProgress('infoProcessing', t('processingRequestForRole', 'Processando requisição para {{role}}...'), { role });
        console.log('showProgress chamado com sucesso');

        // Criação dos headers
        const headers = createAuthHeaders();
        console.log('Headers criados:', headers);

        let success = false;
        for (let attempt = 1; attempt <= retries; attempt++) {
            console.log(`Tentativa ${attempt} de ${retries} para chamar ${role}`);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 90000);

                const body = { role, message: userMessage };
                if (session_id) body.session_id = session_id;
                if (client_id) body.client_id = client_id;
                if (attendance_id) body.attendance_id = attendance_id;

                console.log('Enviando requisição para /api/call-bot:', { body });

                const response = await fetch(API_CALL_BOT_URL, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    signal: controller.signal
                });
                console.log('fetch executado com sucesso');

                const responseText = await response.text();
                console.log('Resposta recebida:', { status: response.status, body: responseText });

                clearTimeout(timeoutId);

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (err) {
                    console.error('Erro ao parsear JSON da resposta:', err, { responseText });
                    throw new Error(t('invalidServerResponse', 'Resposta inválida do servidor (não JSON).'));
                }

                if (!response.ok) {
                    console.error('Resposta não OK:', { status: response.status, data });
                    throw new Error(data.error || t('errorCallingBotAPI', `Erro ${response.status} ao chamar API do bot.`));
                }

                const reply = data.choices?.[0]?.message?.content;
                if (reply != null) {
                    success = true;
                    if (data.generated_session_id && AppState.currentSessionId !== data.generated_session_id) {
                        console.log(`Atualizando session ID no estado e localStorage para: ${data.generated_session_id}`);
                        AppState.currentSessionId = data.generated_session_id;
                        localStorage.setItem(SESSION_ID_STORAGE_KEY, data.generated_session_id);
                    } else if (session_id && !AppState.currentSessionId) {
                        AppState.currentSessionId = session_id;
                    }
                    console.log('callBotAPI retornou com sucesso:', { reply: reply.substring(0, 50) + '...' });
                    return reply.trim();
                } else if (data.warning) {
                    console.warn('callBotAPI recebeu aviso do backend:', data.warning);
                    showError('apiWarning', t('serverWarning', 'Aviso do servidor: ') + data.warning);
                    success = true;
                    return '';
                } else {
                    console.error('Resposta do backend OK, mas formato inesperado:', data);
                    throw new Error(t('unexpectedBotResponse', 'Resposta inesperada ou vazia do backend ao chamar o bot.'));
                }
            } catch (err) {
                console.error(`Tentativa ${attempt} falhou para ${role}:`, err.message, err.stack);
                success = false;
                if (attempt === retries) {
                    const isTimeout = err.name === 'AbortError';
                    showError(
                        isTimeout ? 'timeoutError' : 'apiError',
                        isTimeout ? t('timeoutError', 'A requisição para {{role}} demorou muito.') : t('errorCallingRole', `Erro ao chamar ${role}: ${err.message}`),
                        { role }
                    );
                    err.handled = true;
                    throw err;
                }
                await delay(1000 * attempt);
            } finally {
                if (attempt === retries || success) {
                    clearProgress();
                }
            }
        }
        throw new Error(t('failedBotAPICall', `Falha ao chamar API para ${role} após ${retries} tentativas.`));
    } catch (err) {
        console.error('Erro antes do loop de tentativas:', err.message, err.stack);
        throw err;
    }
}

/**
 * Busca o histórico de mensagens para uma sessão específica.
 */
export async function getSessionHistory(session_id) {
    if (!session_id) {
        console.warn("getSessionHistory chamado sem session_id");
        return { history: [] };
    }
    console.log(`Buscando histórico para session_id: ${session_id}`);
    const historyUrl = `${API_SESSION_HISTORY_URL_BASE}/${session_id}`;
    const headers = createAuthHeaders();

    try {
        const response = await fetch(historyUrl, { method: 'GET', headers });
        const data = await response.json().catch(err => {
            console.error("Erro ao parsear JSON de getSessionHistory:", err);
            throw new Error(t('invalidHistoryResponse', 'Resposta inválida (não JSON) ao buscar histórico.'));
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.log(`Histórico não encontrado (404) para session_id: ${session_id}`);
                return { history: [] };
            }
            throw new Error(data.error || t('errorFetchingHistoryStatus', `Erro ${response.status}`));
        }
        return data || { history: [] };
    } catch (err) {
        console.error(`Erro ao recuperar histórico (session: ${session_id}):`, err);
        showError('errorFetchingHistory', t('errorFetchingHistory', `Falha ao carregar histórico: ${err.message}`));
        throw err;
    }
}

/**
 * Busca a lista de assistentes.
 */
export async function getAssistants() {
    console.log("Buscando lista de assistentes...");
    const headers = createAuthHeaders();
    if (!headers['Authorization']) throw new Error(t('authTokenNotFound', 'Token de autenticação não encontrado.'));

    try {
        const response = await fetch(API_ASSISTANTS_URL, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('errorFetchingAssistantsStatus', `Erro ${response.status}`));
        return data.assistants || [];
    } catch (err) {
        console.error('Erro detalhado ao buscar assistentes:', err);
        showError('apiError', t('errorFetchingAssistants', `Erro ao buscar assistentes: ${err.message}`));
        throw err;
    }
}

/**
 * Adiciona um novo assistente.
 */
export async function addAssistant(username, password) {
    console.log(`Tentando adicionar assistente: ${username}`);
    const headers = createAuthHeaders();
    if (!headers['Authorization']) throw new Error(t('authTokenNotFound', 'Token de autenticação não encontrado.'));

    try {
        const response = await fetch(API_ASSISTANTS_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('errorAddingAssistantStatus', `Erro ${response.status}`));
        return data;
    } catch (err) {
        console.error('Erro detalhado ao adicionar assistente:', err);
        throw err;
    }
}

/**
 * Busca a lista de clientes.
 */
export async function getClients() {
    console.log("Buscando lista de clientes...");
    const headers = createAuthHeaders();
    if (!headers['Authorization']) throw new Error(t('authTokenNotFound', 'Token não encontrado.'));

    try {
        const response = await fetch(API_CLIENTS_URL, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('errorFetchingClientsStatus', `Erro ${response.status}`));
        return data.clients || [];
    } catch (err) {
        console.error("Erro ao buscar clientes:", err);
        showError('apiError', t('errorFetchingClients', `Erro ao buscar clientes: ${err.message}`));
        throw err;
    }
}

/**
 * Adiciona um novo cliente.
 */
export async function addClient(name, cpf, dob) {
    console.log(`Tentando adicionar cliente: ${name}`);
    const headers = createAuthHeaders();
    if (!headers['Authorization']) throw new Error(t('authTokenNotFound', 'Token não encontrado.'));

    const body = { name };
    if (cpf) body.cpf = cpf.replace(/\D/g, '');
    if (dob) body.dob = dob;

    try {
        const response = await fetch(API_CLIENTS_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('errorAddingClientStatus', `Erro ${response.status}`));
        return data;
    } catch (err) {
        console.error("Erro ao adicionar cliente:", err);
        throw err;
    }
}

export async function addAttendance(clientId, description) {
    const t = getT();
    console.log(`Tentando adicionar atendimento para cliente ID: ${clientId}`);
    const headers = createAuthHeaders();
    if (!headers['Authorization']) throw new Error(t('authTokenNotFound', 'Token de autenticação não encontrado.'));

    const body = { client_id: clientId, description };
    try {
        const response = await fetch(`${API_BASE_URL}/attendances`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('errorAddingAttendance', `Erro ${response.status} ao adicionar atendimento.`));
        return data;
    } catch (err) {
        console.error("Erro ao adicionar atendimento:", err);
        throw err;
    }
}

/**
 * Busca a lista de atendimentos para um cliente específico.
 */
export async function getClientAttendances(clientId) {
    if (!clientId) {
        console.warn("getClientAttendances chamado sem clientId");
        return { attendances: [] };
    }
    console.log(`Buscando atendimentos para cliente ID: ${clientId}`);
    const attendancesUrl = `${API_BASE_URL}/clients/${clientId}/attendances`;
    const headers = createAuthHeaders();
    const t = getT();

    try {
        const response = await fetch(attendancesUrl, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || t('errorFetchingClientAttendancesStatus', `Erro ${response.status} ao buscar atendimentos.`));
        }
        return data || { attendances: [] };
    } catch (err) {
        console.error(`Erro ao buscar atendimentos para cliente ${clientId}:`, err);
        showError('errorFetchingClientAttendances', t('errorFetchingClientAttendances', `Erro ao buscar atendimentos: ${err.message}`));
        throw err;
    }
}

/**
 * Busca as sessões de análise para um atendimento específico.
 */
export async function getAttendanceSessions(attendanceId) {
    if (!attendanceId) {
        console.warn("getAttendanceSessions chamado sem attendanceId");
        return { sessions: [] };
    }
    console.log(`Buscando sessões para atendimento ID: ${attendanceId}`);
    const sessionsUrl = `${API_BASE_URL}/attendances/${attendanceId}/sessions`;
    const headers = createAuthHeaders();

    try {
        const response = await fetch(sessionsUrl, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 404) return { sessions: [] };
            throw new Error(data.error || t('errorFetchingAttendanceSessionsStatus', `Erro ${response.status} ao buscar sessões do atendimento.`));
        }
        return data || { sessions: [] };
    } catch (err) {
        console.error(`Erro ao buscar sessões para atendimento ${attendanceId}:`, err);
        showError('errorFetchingAttendanceSessions', t('errorFetchingAttendanceSessions', `Erro ao buscar sessões do atendimento: ${err.message}`));
        throw err;
    }
}

/**
 * Busca detalhes de um atendimento específico.
 */
export async function fetchAttendance(attendanceId) {
    if (!attendanceId) throw new Error(t('attendanceIdNotProvided', 'ID do atendimento não fornecido.'));
    console.log(`Buscando detalhes do atendimento ID: ${attendanceId}`);
    const attendanceUrl = `${API_BASE_URL}/attendances/${attendanceId}`;
    const headers = createAuthHeaders();

    try {
        const response = await fetch(attendanceUrl, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || t('errorFetchingAttendanceStatus', `Erro ${response.status} ao buscar atendimento.`));
        }
        return data.attendance;
    } catch (error) {
        console.error(`Erro ao buscar atendimento ${attendanceId}:`, error);
        showError('errorFetchingAttendance', t('errorFetchingAttendance', `Erro ao buscar atendimento: ${error.message}`));
        throw error;
    }
}