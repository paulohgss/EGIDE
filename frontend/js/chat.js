import * as Config from './config.js';
import { AppState, resetCaseState, SESSION_ID_STORAGE_KEY } from './state.js';
import { DOM, initializeDOM } from './dom-elements.js';
import { showError, toggleSpinner, updateElementVisibility, resetUIForNewCase, showFinalResponse, clearProgress, showProgress } from './ui.js';
import { initializeTheme, toggleTheme } from './theme.js';
import { initializeI18n, updateContent, getBotLogPrefix, i18nInstance } from './i18n.js';
import { callBotAPI, getSessionHistory } from './api.js';
import { addToHistoryAndLog, renderLogs, handleClearLogs, exportLogs, formatBackendHistoryToLogs, formatBackendHistoryToString } from './logs.js';
import { downloadConversationAsPdf } from './pdf.js';

async function loadSessionData(sessionId) {
    if (!sessionId) {
        console.warn("[loadSessionData] sessionId não fornecido.");
        return;
    }

    console.log(`[loadSessionData] Tentando carregar dados para a sessão: ${sessionId}`);
    const t = i18nInstance.t.bind(i18nInstance);
    showProgress('infoLoadingHistory', t('loadingHistory', 'Carregando histórico...'));
    toggleSpinner(true);
    try {
        const sessionData = await getSessionHistory(sessionId);
        console.log(`[loadSessionData] Dados retornados por getSessionHistory:`, JSON.stringify(sessionData, null, 2));

        const backendHistory = sessionData?.history || sessionData || [];
        console.log(`[loadSessionData] backendHistory extraído:`, JSON.stringify(backendHistory, null, 2));

        if (Array.isArray(backendHistory) && backendHistory.length > 0) {
            console.log(`[loadSessionData] Histórico contém ${backendHistory.length} entradas.`);

            AppState.historicoConversa = formatBackendHistoryToString(backendHistory);
            console.log(`[loadSessionData] AppState.historicoConversa preenchido:`, AppState.historicoConversa.substring(0, 100 100) + "...");

            AppState.logs = formatBackendHistoryToLogs(backendHistory);
            console.log(`[loadSessionData] AppState.logs preenchido com ${AppState.logs.length} entradas:`, JSON.stringify(AppState.logs, null, 2));

            AppState.currentSessionId = sessionId;
            AppState.filtroAtual = 'ALL';

            console.log("[loadSessionData] Chamando renderLogs...");
            renderLogs();
            if (DOM.logsIndividuais) {
                DOM.logsIndividuais.style.display = 'block';
                updateElementVisibility(DOM.logsIndividuais, true);
                requestAnimationFrame(() => {
                    if (DOM.logsIndividuais.classList.contains('d-none')) {
                        console.warn("[loadSessionData] #logsIndividuais ainda com d-none, forçando remoção.");
                        DOM.logsIndividuais.classList.remove('d-none');
                    }
                    DOM.logsIndividuais.style.display = 'block';
                    console.log("[loadSessionData] Classe final de #logsIndividuais:", DOM.logsIndividuais.className);
                    console.log("[loadSessionData] Estilos computados de #logsIndividuais:", {
                        display: window.getComputedStyle(DOM.logsIndividuais).display,
                        visibility: window.getComputedStyle(DOM.logsIndividuais).visibility,
                        opacity: window.getComputedStyle(DOM.logsIndividuais).opacity
                    });
                    const logEntries = DOM.logsIndividuais.querySelectorAll('.log-entry');
                    logEntries.forEach((entry, index) => {
                        console.log(`[loadSessionData] Estilos computados do log-entry ${index + 1}:`, {
                            display: window.getComputedStyle(entry).display,
                            visibility: window.getComputedStyle(entry).visibility,
                            opacity: window.getComputedStyle(entry).opacity
                        });
                    });
                });
                console.log("[loadSessionData] #logsIndividuais visível, conteúdo:", DOM.logsIndividuais.innerHTML);
            } else {
                console.error("[loadSessionData] Elemento #logsIndividuais não encontrado.");
            }
            console.log("[loadSessionData] renderLogs chamado.");

            const lastSupervisorEntry = [...backendHistory].reverse().find(
                entry => entry.type === 'bot_response' && entry.role === 'supervisor'
            );

            if (lastSupervisorEntry?.content) {
                AppState.ultimaMensagemSupervisor = lastSupervisorEntry.content;
                console.log(`[loadSessionData] Exibindo resposta final do supervisor:`, AppState.ultimaMensagemSupervisor.substring(0, 50) + "...");
                showFinalResponse(AppState.ultimaMensagemSupervisor);
                updateElementVisibility(DOM.downloadPdfBtn, true);
                checkIfSupervisorNeedsInput(AppState.ultimaMensagemSupervisor);
            } else {
                console.log(`[loadSessionData] Nenhuma resposta do supervisor encontrada.`);
                if (DOM.respostaFinal) DOM.respostaFinal.textContent = '';
                updateElementVisibility(DOM.respostaFinal, false);
                updateElementVisibility(DOM.downloadPdfBtn, false);
            }
            console.log(`[loadSessionData] Sessão ${sessionId} restaurada com histórico completo.`);
        } else {
            console.log(`[loadSessionData] Nenhum histórico encontrado para a sessão ${sessionId} ou histórico vazio.`);
            localStorage.removeItem(SESSION_ID_STORAGE_KEY);
            AppState.currentSessionId = null;
            AppState.filtroAtual = 'ALL';
            resetUIForNewCase();
            renderLogs();
            updateElementVisibility(DOM.logsIndividuais, false);
        }
    } catch (error) {
        console.error(`[loadSessionData] Erro ao carregar histórico da sessão ${sessionId}:`, error);
        localStorage.removeItem(SESSION_ID_STORAGE_KEY);
        AppState.currentSessionId = null;
        AppState.filtroAtual = 'ALL';
        resetUIForNewCase();
        renderLogs();
        updateElementVisibility(DOM.logsIndividuais, false);
        showError('errorSessionNotFound', t('errorSessionNotFound', `Não foi possível carregar o histórico: ${error.message}`));
    } finally {
        clearProgress();
        toggleSpinner(false);
    }
}

function handleLogout() {
    console.log("Executando logout...");
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem(SESSION_ID_STORAGE_KEY);
    window.location.href = 'login.html';
}

function containsKeywords(text, keywords) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

function checkIfSupervisorNeedsInput(supervisorText) {
    const t = i18nInstance.t.bind(i18nInstance);
    if (!supervisorText) {
        AppState.aguardandoRespostaUsuario = false;
        updateElementVisibility(DOM.respostaUsuarioBox, false);
        return;
    }
    const needsInput = Config.REGEX_PEDIDO_INFO.test(supervisorText);
    AppState.aguardandoRespostaUsuario = needsInput;
    updateElementVisibility(DOM.respostaUsuarioBox, needsInput);

    if (needsInput) {
        if (DOM.respostaUsuarioInput) {
            DOM.respostaUsuarioInput.focus();
            DOM.respostaUsuarioInput.placeholder = t('supervisorResponsePlaceholder', 'Digite a informação solicitada aqui...');
        }
    }
}

async function mainCaseFlow(initialInput) {
    const t = i18nInstance.t.bind(i18nInstance);
    const user_id = localStorage.getItem('user_id');

    let currentSessionId = AppState.currentSessionId;
    const isNewSessionFlow = !currentSessionId;

    const clientIdToLink = AppState.pendingClientId; // client_1746308221062_6csvs
    const clientNameContext = AppState.pendingClientName;
    const attendanceId = sessionStorage.getItem('selectedAttendanceId'); // attendance_1746313026885_5d4no
    AppState.pendingClientId = null;
    AppState.pendingClientName = null;
    sessionStorage.removeItem('selectedAttendanceId');

    console.log('Chamando callBotAPI para redator:', {
        initialInput,
        user_id,
        clientIdToLink,
        attendanceId
    });

    toggleSpinner(true);

    let logInitialInput = initialInput;
    if (isNewSessionFlow && clientNameContext) {
        logInitialInput = `(${t('client', 'Cliente')}: ${clientNameContext}) ${initialInput}`;
    }
    addToHistoryAndLog('usuario', logInitialInput);

    let technicalReport = "";
    let medicalResponse = "";
    let strategicResponse = "";
    let finalReport = "";
    let finalSupervisorResponse = "";
    let hasError = false;

    try {
        console.log("Etapa 1: Chamando Redator para relatório técnico inicial...");
        const redactorRequestMsg = t("supervisorRequestingRedactor");
        addToHistoryAndLog('supervisor', redactorRequestMsg);
        renderLogs();
        technicalReport = await callBotAPI(
            "redator",
            initialInput,
            null,
            clientIdToLink,
            attendanceId
        );
        currentSessionId = AppState.currentSessionId;
        if (!currentSessionId) {
            throw new Error(t('sessionIdNotSet', "Falha ao obter/definir o ID da sessão após a primeira chamada API."));
        }
        addToHistoryAndLog('redator', technicalReport);
        renderLogs();

        console.log("Etapa 2: Chamando Médico para análise médica...");
        const medicalRequestMsg = t("supervisorRequestingMedical");
        addToHistoryAndLog('supervisor', medicalRequestMsg);
        renderLogs();
        try {
            const medicalPrompt = `${technicalReport}\n\nCom base no relatório técnico acima, forneça uma análise médica detalhada.`;
            medicalResponse = await callBotAPI("medico", medicalPrompt, currentSessionId, user_id);
            addToHistoryAndLog('medico', medicalResponse);
            renderLogs();
        } catch (err) {
            console.error("Erro na Etapa 2 (Médico):", err);
            showError('errorCallingBot', t('errorCallingBot', `Erro ao chamar Médico: ${err.message}`), { role: 'medico' });
            hasError = true;
            medicalResponse = t('errorFetchingMedicalAnalysis', 'Erro ao obter análise médica.');
            addToHistoryAndLog('medico', medicalResponse);
            renderLogs();
            throw err;
        }

        console.log("Etapa 3: Chamando Estratégico para análise estratégica...");
        const strategicRequestMsg = t("supervisorRequestingStrategic");
        addToHistoryAndLog('supervisor', strategicRequestMsg);
        renderLogs();
        try {
            const strategicPrompt = `${technicalReport}\n\n${medicalResponse}\n\nCom base no relatório técnico e na análise médica acima, forneça uma análise estratégica para o caso.`;
            strategicResponse = await callBotAPI("estrategico", strategicPrompt, currentSessionId, user_id);
            addToHistoryAndLog('estrategico', strategicResponse);
            renderLogs();
        } catch (err) {
            console.error("Erro na Etapa 3 (Estratégico):", err);
            showError('errorCallingBot', t('errorCallingBot', `Erro ao chamar Estratégico: ${err.message}`), { role: 'estrategico' });
            hasError = true;
            strategicResponse = t('errorFetchingStrategicAnalysis', 'Erro ao obter análise estratégica.');
            addToHistoryAndLog('estrategico', strategicResponse);
            renderLogs();
            throw err;
        }

        console.log("Etapa 4: Chamando Redator para relatório final...");
        const finalReportRequestMsg = t("supervisorRequestingFinalReport");
        addToHistoryAndLog('supervisor', finalReportRequestMsg);
        renderLogs();
        try {
            const finalReportPrompt = `${technicalReport}\n\n${medicalResponse}\n\n${strategicResponse}\n\nCom base nas análises acima, redija um relatório final consolidado.`;
            finalReport = await callBotAPI("redator", finalReportPrompt, currentSessionId, user_id);
            addToHistoryAndLog('redator', finalReport);
            renderLogs();
        } catch (err) {
            console.error("Erro na Etapa 4 (Redator - Relatório Final):", err);
            showError('errorCallingBot', t('errorCallingBot', `Erro ao chamar Redator para relatório final: ${err.message}`), { role: 'redator' });
            hasError = true;
            finalReport = t('errorFetchingFinalReport', 'Erro ao obter relatório final.');
            addToHistoryAndLog('redator', finalReport);
            renderLogs();
            throw err;
        }

        console.log("Etapa 5: Chamando Supervisor para resposta final...");
        const supervisorRequestMsg = t("supervisorProvidingFinalResponse");
        addToHistoryAndLog('supervisor', supervisorRequestMsg);
        renderLogs();
        try {
            const supervisorPrompt = `${AppState.historicoConversa}\n\nCom base em todo o histórico acima, forneça uma resposta final consolidada para o caso. Use '[PEDIDO_INFO]' se precisar de mais informações do usuário.`;
            finalSupervisorResponse = await callBotAPI("supervisor", supervisorPrompt, currentSessionId, user_id);
            AppState.ultimaMensagemSupervisor = finalSupervisorResponse;
            addToHistoryAndLog('supervisor', finalSupervisorResponse);
            renderLogs();

            showFinalResponse(finalSupervisorResponse);
            updateElementVisibility(DOM.downloadPdfBtn, true);
            checkIfSupervisorNeedsInput(finalSupervisorResponse);
        } catch (err) {
            console.error("Erro na Etapa 5 (Supervisor):", err);
            showError('errorCallingBot', t('errorCallingBot', `Erro ao chamar Supervisor: ${err.message}`), { role: 'supervisor' });
            hasError = true;
            finalSupervisorResponse = t('errorFetchingSupervisorResponse', 'Erro ao obter resposta final do supervisor.');
            addToHistoryAndLog('supervisor', finalSupervisorResponse);
            renderLogs();
            throw err;
        }
    } catch (err) {
        console.error("Erro inesperado no fluxo principal:", err);
        if (!hasError) {
            showError('errorProcessingRequest', t('errorProcessingRequest', 'Ocorreu um erro inesperado ao processar o caso.'));
        }
    } finally {
        toggleSpinner(false);
    }
}

async function handleManualBotExecution(role) {
    if (!role) {
        console.error("Role não fornecido para execução manual.");
        return;
    }
    const t = i18nInstance.t.bind(i18nInstance);
    const user_id = localStorage.getItem('user_id') || null;
    const currentSessionId = AppState.currentSessionId;

    if (!currentSessionId) {
        showError("errorSessionRequired", t("errorSessionRequired", "Inicie ou recarregue uma análise primeiro."));
        return;
    }
    if (!AppState.historicoConversa) {
        showError("errorHistoryRequired", t("errorHistoryRequired", "Execute uma análise primeiro para ter histórico."));
        return;
    }

    toggleSpinner(true);
    try {
        console.log(`Execução manual: Chamando ${role}...`);
        const response = await callBotAPI(role, AppState.historicoConversa, currentSessionId, user_id);
        console.log(`Resposta de ${role} (manual):`, response.substring(0, 50) + "...");

        const manualLogText = `(${t('manualLogSuffix', 'Manual')}) ${response}`;
        addToHistoryAndLog(role, manualLogText);

        if (role === 'supervisor') {
            AppState.ultimaMensagemSupervisor = response;
            showFinalResponse(response);
            checkIfSupervisorNeedsInput(response);
        }
        updateElementVisibility(DOM.downloadPdfBtn, true);
    } catch (err) {
        console.error(`Erro na execução manual do ${role}:`, err);
    } finally {
        toggleSpinner(false);
    }
}

async function handleSupervisorResponse() {
    const t = i18nInstance.t.bind(i18nInstance);
    const userInput = DOM.respostaUsuarioInput?.value.trim();
    if (!userInput) {
        showError("errorResponseRequired", t("errorResponseRequired", "Por favor, forneça a informação solicitada."));
        return;
    }

    const user_id = localStorage.getItem('user_id') || null;
    const currentSessionId = AppState.currentSessionId;

    if (!currentSessionId) {
        showError("errorSessionRequired", t("errorSessionRequired", "Sessão não encontrada. Inicie ou recarregue uma análise."));
        return;
    }

    toggleSpinner(true);
    updateElementVisibility(DOM.respostaUsuarioBox, false);
    AppState.aguardandoRespostaUsuario = false;

    const userResponseLogText = `(${t('responseToSupervisorSuffix', 'Resposta para Supervisor')}) ${userInput}`;
    addToHistoryAndLog('usuario', userResponseLogText);

    try {
        console.log("Chamando Supervisor com resposta do usuário...");
        const contextForSupervisor = AppState.historicoConversa;
        const supervisorPrompt = `${contextForSupervisor}\n\n---\nSupervisor, por favor, considere a última resposta do usuário e continue a análise ou forneça uma resposta final. Se precisar de mais informações, use '[PEDIDO_INFO]'.`;
        const supervisorNewResponse = await callBotAPI("supervisor", supervisorPrompt, currentSessionId, user_id);
        console.log("Supervisor respondeu com sucesso:", supervisorNewResponse.substring(0, 50) + "...");

        AppState.ultimaMensagemSupervisor = supervisorNewResponse;
        addToHistoryAndLog('supervisor', supervisorNewResponse);

        showFinalResponse(supervisorNewResponse);
        updateElementVisibility(DOM.downloadPdfBtn, true);
        if (DOM.respostaUsuarioInput) DOM.respostaUsuarioInput.value = "";

        checkIfSupervisorNeedsInput(supervisorNewResponse);
    } catch (err) {
        console.error("Erro ao responder ao supervisor:", err);
    } finally {
        toggleSpinner(false);
    }
}

function setupEventListeners() {
    const t = i18nInstance.t.bind(i18nInstance);
    DOM.themeToggle?.addEventListener('click', toggleTheme);
    DOM.languageSelect?.addEventListener('change', (e) => changeLanguage(e.target.value));

    DOM.caseForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const userInput = DOM.entradaUsuario?.value.trim();
        if (!userInput) {
            showError('errorCaseRequired', t('errorCaseRequired', 'Por favor, descreva o caso.'));
            return;
        }
        if (AppState.aguardandoRespostaUsuario) {
            console.warn("Envio de novo caso bloqueado: Aguardando resposta do usuário.");
            showError("errorInputBlocked", t("errorInputBlocked", "Responda à solicitação do supervisor antes de enviar um novo caso."));
            return;
        }
        mainCaseFlow(userInput);
    });

    DOM.manualActionButtons?.forEach(button => {
        button.addEventListener('click', () => {
            if (AppState.aguardandoRespostaUsuario) {
                console.warn("Ação manual bloqueada: Aguardando resposta do usuário.");
                showError("errorActionBlocked", t("errorActionBlocked", "Responda ao supervisor antes de continuar."));
                return;
            }
            const role = button.getAttribute('data-bot-role');
            handleManualBotExecution(role);
        });
    });

    DOM.filterSelect?.addEventListener('change', (e) => {
        AppState.filtroAtual = e.target.value;
        renderLogs();
    });

    DOM.clearLogsBtn?.addEventListener('click', handleClearLogs);
    DOM.exportLogsBtn?.addEventListener('click', exportLogs);
    DOM.downloadPdfBtn?.addEventListener('click', downloadConversationAsPdf);
    DOM.respondSupervisorBtn?.addEventListener('click', handleSupervisorResponse);

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (event) => {
            event.preventDefault();
            handleLogout();
        });
    } else {
        console.warn("Elemento de logout #logout-link não encontrado.");
    }

    console.log("Event listeners configurados.");
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Aplicação Égide Iniciando...");

    const token = localStorage.getItem('token');
    if (!token) {
        console.log("Nenhum token encontrado, redirecionando para login.");
        window.location.href = 'login.html';
        return;
    }

    try {
        initializeDOM();
        if (!DOM.logsIndividuais) {
            console.error("Elemento #logsIndividuais não encontrado após initializeDOM.");
        }

        await initializeI18n();
        updateContent(DOM);

        initializeTheme();

        setupEventListeners();

        const t = i18nInstance.t.bind(i18nInstance);
        const cameFrom = sessionStorage.getItem('cameFrom');
        console.log(`Origem da navegação (cameFrom): ${cameFrom}`);
        const backButton = document.getElementById('back-button');
        if (backButton) {
            if (cameFrom === 'client-sessions') {
                const clientId = sessionStorage.getItem('cameFromClientId');
                const clientName = sessionStorage.getItem('cameFromClientName');
                if (clientId && clientName) {
                    backButton.href = `client-sessions.html?clientId=${encodeURIComponent(clientId)}&clientName=${encodeURIComponent(clientName)}`;
                    console.log(`Botão 'Voltar' configurado para: ${backButton.href}`);
                } else {
                    console.warn("clientId ou clientName não encontrados no sessionStorage. Voltando para clients.html.");
                    backButton.href = 'clients.html';
                    console.log(`Botão 'Voltar' configurado para: ${backButton.href}`);
                }
            } else {
                backButton.href = 'index.html';
                console.log(`Botão 'Voltar' configurado para: ${backButton.href}`);
            }
        } else {
            console.warn("Botão 'Voltar' (#back-button) não encontrado no DOM.");
        }

        const selectedClientId = sessionStorage.getItem('selectedClientId');
        const selectedClientName = sessionStorage.getItem('selectedClientName');
        const selectedAttendanceDescription = sessionStorage.getItem('selectedAttendanceDescription');

        // Exibir descrição do atendimento imediatamente
        const caseDescriptionElement = document.getElementById('caseDescription');
        if (caseDescriptionElement && selectedAttendanceDescription) {
            console.log(`Exibindo descrição do atendimento: ${selectedAttendanceDescription.substring(0, 50)}...`);
            caseDescriptionElement.textContent = selectedAttendanceDescription;
            caseDescriptionElement.classList.remove('d-none');
        } else {
            console.warn('Elemento #caseDescription não encontrado ou descrição ausente.');
            if (!caseDescriptionElement) {
                console.warn('Verifique se o elemento com ID "caseDescription" existe em chat.html.');
            }
            if (!selectedAttendanceDescription) {
                console.warn('Nenhuma descrição de atendimento encontrada no sessionStorage.');
            }
        }

        if (selectedClientId) {
            console.log(`Cliente selecionado encontrado: ${selectedClientName} (ID: ${selectedClientId}). Preparando para nova análise.`);
            sessionStorage.removeItem('selectedClientId');
            sessionStorage.removeItem('selectedClientName');
            localStorage.removeItem(SESSION_ID_STORAGE_KEY);
            AppState.currentSessionId = null;
            AppState.filtroAtual = 'ALL';
            resetCaseState();
            resetUIForNewCase();
            renderLogs();
            AppState.pendingClientId = selectedClientId;
            AppState.pendingClientName = selectedClientName;

            if (selectedAttendanceDescription) {
                console.log(`Descrição do atendimento encontrada: ${selectedAttendanceDescription.substring(0, 50)}...`);
                sessionStorage.removeItem selectedAttendanceDescription');
                mainCaseFlow(selectedAttendanceDescription);
            } else if (DOM.entradaUsuario) {
                DOM.entradaUsuario.value = '';
                DOM.entradaUsuario.placeholder = t('startAnalysisPlaceholder', `Iniciando análise para o cliente: ${AppState.pendingClientName}.\n\nDescreva o caso ou a pergunta inicial:`);
                DOM.entradaUsuario.focus();
            }
        }

        const sessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
        if (sessionId && !selectedClientId) {
            console.log(`Carregando histórico para sessionId: ${sessionId}`);
            await loadSessionData(sessionId);
        } else if (!selectedClientId) {
            console.warn("Nenhum session_id ou cliente selecionado encontrado no localStorage.");
            resetUIForNewCase();
            renderLogs();
        }
    } catch (err) {
        console.error("Erro ao inicializar aplicação:", err);
        showError('errorAppInit', t('errorAppInit', 'Erro ao carregar a aplicação.'));
    }
});