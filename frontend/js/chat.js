import * as Config from './config.js';
import { AppState, resetCaseState, SESSION_ID_STORAGE_KEY } from './state.js';
import { DOM } from './dom-elements.js';
import { showError, toggleSpinner, updateElementVisibility, resetUIForNewCase, showFinalResponse, clearProgress, showProgress } from './ui.js';
import { initializeTheme, toggleTheme } from './theme.js';
import { initializeI18n, updateContent, changeLanguage, getBotLogPrefix, i18nInstance } from './i18n.js';
import { callBotAPI, getSessionHistory } from './api.js';
import { addToHistoryAndLog, renderLogs, handleClearLogs, exportLogs, formatBackendHistoryToLogs, formatBackendHistoryToString } from './logs.js';
import { downloadConversationAsPdf } from './pdf.js';

async function loadSessionData(sessionId) {
    if (!sessionId) return;

    console.log(`[loadSessionData] Tentando carregar dados para a sessão: ${sessionId}`);
    showProgress('infoLoadingHistory', 'Carregando histórico...');
    toggleSpinner(true);
    try {
        const sessionData = await getSessionHistory(sessionId);
        console.log(`[loadSessionData] Dados retornados por getSessionHistory:`, sessionData);

        const backendHistory = sessionData?.history || sessionData || [];
        console.log(`[loadSessionData] backendHistory extraído:`, backendHistory);

        if (Array.isArray(backendHistory) && backendHistory.length > 0) {
            console.log(`[loadSessionData] Histórico contém ${backendHistory.length} entradas.`);

            AppState.historicoConversa = formatBackendHistoryToString(backendHistory);
            console.log(`[loadSessionData] AppState.historicoConversa preenchido:`, AppState.historicoConversa.substring(0, 100) + "...");

            AppState.logs = formatBackendHistoryToLogs(backendHistory);
            console.log(`[loadSessionData] AppState.logs preenchido com ${AppState.logs.length} entradas:`, AppState.logs);

            AppState.currentSessionId = sessionId;
            AppState.filtroAtual = 'ALL';

            renderLogs();

            const lastSupervisorEntry = [...backendHistory].reverse().find(
                entry => entry.type === 'bot_response' && entry.role === 'supervisor'
            );

            if (lastSupervisorEntry?.content) {
                AppState.ultimaMensagemSupervisor = lastSupervisorEntry.content;
                showFinalResponse(AppState.ultimaMensagemSupervisor);
                updateElementVisibility(DOM.downloadPdfBtn, true);
                checkIfSupervisorNeedsInput(AppState.ultimaMensagemSupervisor);
                console.log(`[loadSessionData] Última resposta do supervisor encontrada e exibida:`, AppState.ultimaMensagemSupervisor.substring(0, 50) + "...");
            } else {
                if (DOM.respostaFinal) DOM.respostaFinal.textContent = '';
                updateElementVisibility(DOM.respostaFinal, false);
                updateElementVisibility(DOM.downloadPdfBtn, false);
                console.log(`[loadSessionData] Nenhuma resposta do supervisor encontrada.`);
            }
            console.log(`[loadSessionData] Sessão ${sessionId} restaurada com histórico completo.`);
        } else {
            console.log(`[loadSessionData] Nenhum histórico encontrado para a sessão ${sessionId} ou histórico vazio.`);
            localStorage.removeItem(SESSION_ID_STORAGE_KEY);
            AppState.currentSessionId = null;
            AppState.filtroAtual = 'ALL';
            resetUIForNewCase();
            renderLogs();
        }
    } catch (error) {
        console.error(`[loadSessionData] Erro ao carregar histórico da sessão ${sessionId}:`, error);
        localStorage.removeItem(SESSION_ID_STORAGE_KEY);
        AppState.currentSessionId = null;
        AppState.filtroAtual = 'ALL';
        resetUIForNewCase();
        renderLogs();
    } finally {
        clearProgress();
        toggleSpinner(false);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Aplicação Égide Iniciando...");

    // Inicializa os elementos DOM após o DOM estar pronto
    DOM.initialize();
    console.log("Elementos DOM inicializados:", {
        logsIndividuaisExists: !!DOM.logsIndividuais,
        respostaFinalExists: !!DOM.respostaFinal
    });

    const token = localStorage.getItem('token');
    if (!token && !window.location.pathname.endsWith('/login.html') && !window.location.pathname.endsWith('/register.html')) {
        console.log("Nenhum token encontrado, redirecionando para login.");
        window.location.href = 'login.html';
        return;
    }

    const backButton = document.getElementById('back-button');
    if (backButton) {
        const cameFrom = sessionStorage.getItem('cameFrom');
        console.log("Origem da navegação (cameFrom):", cameFrom);

        if (cameFrom === 'client-sessions') {
            console.warn("Navegação de volta para client-sessions.html ainda não implementada completamente (falta client_id). Voltando para clients.html.");
            backButton.href = 'clients.html';
        } else if (cameFrom === 'clients') {
            backButton.href = 'clients.html';
        } else if (cameFrom === 'index') {
            backButton.href = 'index.html';
        } else {
            backButton.href = 'index.html';
        }
        console.log("Botão 'Voltar' configurado para:", backButton.href);
        sessionStorage.removeItem('cameFrom');
    } else {
        console.warn("Botão #back-button não encontrado no DOM.");
    }

    initializeTheme();
    initializeI18n(async (err) => {
        if (err) {
            console.error("Falha ao inicializar i18n:", err);
            if (!window.location.pathname.endsWith('/login.html') && !window.location.pathname.endsWith('/register.html')) {
                alert("Erro ao carregar configurações de idioma.");
            }
            return;
        }

        if (!window.location.pathname.endsWith('/login.html') && !window.location.pathname.endsWith('/register.html')) {
            const userGreetingElement = document.getElementById('user-greeting');
            const userId = localStorage.getItem('user_id');
            if (token && userGreetingElement && userId) {
                userGreetingElement.textContent = `Olá! (ID: ${userId})`;
                userGreetingElement.classList.remove('d-none');
            }

            setupEventListeners();

            const selectedClientId = sessionStorage.getItem('selectedClientId');
            const selectedClientName = sessionStorage.getItem('selectedClientName');

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

                if (DOM.entradaUsuario) {
                    DOM.entradaUsuario.value = '';
                    const placeholderText = `Iniciando análise para o cliente: ${AppState.pendingClientName}.\n\nDescreva o caso ou a pergunta inicial:`;
                    DOM.entradaUsuario.placeholder = placeholderText;
                    DOM.entradaUsuario.focus();
                }
            } else {
                console.log("Nenhum cliente selecionado via sessionStorage. Verificando localStorage para sessão anterior...");
                AppState.pendingClientId = null;
                AppState.pendingClientName = null;
                AppState.filtroAtual = 'ALL';
                const savedSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
                if (savedSessionId) {
                    console.log(`Encontrado session_id salvo: ${savedSessionId}. Carregando...`);
                    await loadSessionData(savedSessionId);
                } else {
                    console.log("Nenhum session_id encontrado no localStorage. Pronto para nova análise genérica.");
                    resetUIForNewCase();
                    renderLogs();
                    if (DOM.entradaUsuario) {
                        DOM.entradaUsuario.placeholder = i18nInstance.t('caseHelp');
                    }
                }
            }

            if (DOM.languageSelect) DOM.languageSelect.value = AppState.currentLanguage;
        } else {
            console.log(`Página de autenticação (${window.location.pathname}). Lógica principal pulada.`);
        }
    });
});

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

    const clientIdToLink = AppState.pendingClientId;
    const clientNameContext = AppState.pendingClientName;
    AppState.pendingClientId = null;
    AppState.pendingClientName = null;

    if (isNewSessionFlow) {
        console.log(`Iniciando nova sessão ${clientIdToLink ? 'para cliente ' + clientIdToLink : 'genérica'}.`);
        renderLogs();
    } else {
        console.log(`Continuando análise na sessão existente: ${currentSessionId}`);
        resetUIForNewCase();
        renderLogs();
    }

    toggleSpinner(true);

    let logInitialInput = initialInput;
    if (isNewSessionFlow && clientNameContext) {
        logInitialInput = `(Cliente: ${clientNameContext}) ${initialInput}`;
    }
    addToHistoryAndLog('usuario', logInitialInput);

    let medicalResponse = "", strategicResponse = "", technicalReport = "", finalReport = "", finalSupervisorResponse = "";
    let hasError = false;

    try {
        console.log("Etapa 1: Chamando Redator para relatório técnico inicial...");
        addToHistoryAndLog('supervisor', t("supervisorRequestingRedactor"));
        try {
            technicalReport = await callBotAPI("redator", initialInput, null, user_id, clientIdToLink);
            currentSessionId = AppState.currentSessionId;
            if (!currentSessionId) {
                throw new Error("Falha ao obter/definir o ID da sessão após a primeira chamada API.");
            }
            addToHistoryAndLog('redator', technicalReport);
            console.log("Redator respondeu com sucesso:", technicalReport.substring(0, 50) + "...");
        } catch (err) {
            console.error("Erro ao chamar Redator:", err);
            showError('errorCallingBot', `Erro ao chamar Redator: ${err.message}`, { role: 'redator' });
            hasError = true;
            technicalReport = "Erro ao obter relatório técnico.";
            addToHistoryAndLog('redator', technicalReport);
        }

        const needsMedicalEval = containsKeywords(initialInput, Config.KEYWORDS_INCAPACIDADE);
        if (needsMedicalEval) {
            console.log("Etapa 2: Chamando Médico para avaliação...");
            addToHistoryAndLog('supervisor', t("supervisorMedicalEvaluation"));
            const medicalInput = `Descrição do Caso:\n${initialInput}\n\nRelatório Técnico Inicial:\n${technicalReport}`;
            try {
                medicalResponse = await callBotAPI("medico", medicalInput, currentSessionId, user_id);
                addToHistoryAndLog('medico', medicalResponse);
                console.log("Médico respondeu com sucesso:", medicalResponse.substring(0, 50) + "...");
            } catch (err) {
                console.error("Erro ao chamar Médico:", err);
                showError('errorCallingBot', `Erro ao chamar Médico: ${err.message}`, { role: 'médico' });
                hasError = true;
                medicalResponse = "Erro ao obter avaliação médica.";
                addToHistoryAndLog('medico', medicalResponse);
            }
        } else {
            console.log("Etapa 2: Avaliação médica não necessária.");
            addToHistoryAndLog('supervisor', t("supervisorNoMedical"));
            medicalResponse = t('noMedicalEvaluationNeeded', 'N/A');
        }

        console.log("Etapa 3: Chamando Estrategista...");
        addToHistoryAndLog('supervisor', t("supervisorConsultingStrategist"));
        const strategistInput = `Descrição do Caso:\n${initialInput}\n\nRelatório Técnico:\n${technicalReport}\n\nAvaliação Médica:\n${medicalResponse || 'Nenhuma realizada'}`;
        try {
            strategicResponse = await callBotAPI("estrategista", strategistInput, currentSessionId, user_id);
            addToHistoryAndLog('estrategista', strategicResponse);
            console.log("Estrategista respondeu com sucesso:", strategicResponse.substring(0, 50) + "...");
        } catch (err) {
            console.error("Erro ao chamar Estrategista:", err);
            showError('errorCallingBot', `Erro ao chamar Estrategista: ${err.message}`, { role: 'estrategista' });
            hasError = true;
            strategicResponse = "Erro ao obter estratégia jurídica.";
            addToHistoryAndLog('estrategista', strategicResponse);
        }

        console.log("Etapa 4: Chamando Redator para relatório final...");
        addToHistoryAndLog('supervisor', t("supervisorRequestingFinalReport"));
        const finalReportInput = `Gere um relatório final consolidado com base nas seguintes informações:\n\nDescrição Original:\n${initialInput}\n\nRelatório Técnico:\n${technicalReport}\n\nAvaliação Médica:\n${medicalResponse || 'Nenhuma realizada'}\n\nEstratégia Jurídica Sugerida:\n${strategicResponse}`;
        try {
            finalReport = await callBotAPI("redator", finalReportInput, currentSessionId, user_id);
            addToHistoryAndLog('redator', `RELATÓRIO FINAL CONSOLIDADO:\n${finalReport}`);
            console.log("Redator (relatório final) respondeu com sucesso:", finalReport.substring(0, 50) + "...");
        } catch (err) {
            console.error("Erro ao chamar Redator (relatório final):", err);
            showError('errorCallingBot', `Erro ao chamar Redator (relatório final): ${err.message}`, { role: 'redator' });
            hasError = true;
            finalReport = "Erro ao obter relatório final.";
            addToHistoryAndLog('redator', `RELATÓRIO FINAL CONSOLIDADO:\n${finalReport}`);
        }

        console.log("Etapa 5: Chamando Supervisor...");
        addToHistoryAndLog('supervisor', t("supervisorConsolidating", "Consolidando análise para resposta final..."));
        const supervisorInput = `CONTEXTO COMPLETO:\n${AppState.historicoConversa}\n\n---\nCom base em TODO o histórico acima (incluindo o relatório final consolidado do redator), forneça uma resposta final concisa e clara para o usuário, resumindo a análise e indicando os próximos passos ou a conclusão estratégica. Se precisar de mais informações, peça de forma explícita usando a frase '[PEDIDO_INFO]'.`;
        try {
            finalSupervisorResponse = await callBotAPI("supervisor", supervisorInput, currentSessionId, user_id);
            AppState.ultimaMensagemSupervisor = finalSupervisorResponse;
            addToHistoryAndLog('supervisor', finalSupervisorResponse);
            console.log("Supervisor respondeu com sucesso:", finalSupervisorResponse.substring(0, 50) + "...");
        } catch (err) {
            console.error("Erro ao chamar Supervisor:", err);
            showError('errorCallingBot', `Erro ao chamar Supervisor: ${err.message}`, { role: 'supervisor' });
            hasError = true;
            finalSupervisorResponse = "Erro ao obter resposta final do Supervisor.";
            addToHistoryAndLog('supervisor', finalSupervisorResponse);
        }

        showFinalResponse(finalSupervisorResponse);
        updateElementVisibility(DOM.downloadPdfBtn, true);
        checkIfSupervisorNeedsInput(finalSupervisorResponse);
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
    DOM.themeToggle?.addEventListener('click', toggleTheme);
    DOM.languageSelect?.addEventListener('change', (e) => changeLanguage(e.target.value));

    DOM.caseForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const t = i18nInstance.t.bind(i18nInstance);
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
            const t = i18nInstance.t.bind(i18nInstance);
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