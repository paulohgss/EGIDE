import * as Config from './config.js';
import { AppState, resetCaseState, SESSION_ID_STORAGE_KEY } from './state.js';
import { DOM, initializeDOM } from './dom-elements.js';
import { showError, showProgress, toggleSpinner, updateElementVisibility, resetUIForNewCase, clearProgress } from './ui.js';
import { initializeTheme, toggleTheme } from './theme.js';
import { initializeI18n, updateContent, getBotLogPrefix, i18nInstance, getT } from './i18n.js';
import { callBotAPI, getSessionHistory } from './api.js';
import { addToHistoryAndLog, renderLogs, handleClearLogs, exportLogs, formatBackendHistoryToLogs, formatBackendHistoryToString } from './logs.js';
import { downloadConversationAsPdf } from './pdf.js';

// Função de fallback para tradução, caso i18nInstance não esteja pronta
const fallbackT = (key, fallback) => fallback;

async function loadSessionData(sessionId) {
    if (!sessionId) {
        console.warn("[loadSessionData] sessionId não fornecido.");
        return;
    }

    console.log(`[loadSessionData] Tentando carregar dados para a sessão: ${sessionId}`);
    const t = i18nInstance && i18nInstance.t ? i18nInstance.t.bind(i18nInstance) : fallbackT;
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
            console.log(`[loadSessionData] AppState.historicoConversa preenchido:`, AppState.historicoConversa.substring(0, 100) + "...");

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
                console.log(`[loadSessionData] Última mensagem do supervisor:`, AppState.ultimaMensagemSupervisor.substring(0, 50) + "...");
                updateElementVisibility(DOM.downloadPdfBtn, true);
                checkIfSupervisorNeedsInput(AppState.ultimaMensagemSupervisor);
            } else {
                console.log(`[loadSessionData] Nenhuma resposta do supervisor encontrada.`);
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

function checkIfSupervisorNeedsInput(supervisorText) {
    const t = i18nInstance && i18nInstance.t ? i18nInstance.t.bind(i18nInstance) : fallbackT;
    if (!supervisorText) {
        AppState.aguardandoRespostaUsuario = false;
        if (DOM.entradaUsuario) {
            DOM.entradaUsuario.placeholder = t('startAnalysisPlaceholder', 'Digite o caso ou a pergunta inicial...');
            DOM.entradaUsuario.classList.remove('border-warning');
        }
        return;
    }
    const needsInput = Config.REGEX_PEDIDO_INFO.test(supervisorText);
    AppState.aguardandoRespostaUsuario = needsInput;
    if (DOM.entradaUsuario) {
        DOM.entradaUsuario.placeholder = needsInput 
            ? t('supervisorResponsePlaceholder', 'Digite a informação solicitada aqui...')
            : t('startAnalysisPlaceholder', 'Digite o caso ou a pergunta inicial...');
        DOM.entradaUsuario.classList.toggle('border-warning', needsInput);
        DOM.entradaUsuario.focus();
    }
}

async function mainCaseFlow(initialInput) {
    const t = i18nInstance && i18nInstance.t ? i18nInstance.t.bind(i18nInstance) : fallbackT;
    const user_id = localStorage.getItem('user_id');

    let currentSessionId = AppState.currentSessionId;
    const isNewSessionFlow = !currentSessionId;

    const clientIdToLink = AppState.pendingClientId;
    const clientNameContext = AppState.pendingClientName;
    const attendanceId = sessionStorage.getItem('selectedAttendanceId');
    AppState.pendingClientId = null;
    AppState.pendingClientName = null;
    sessionStorage.removeItem('selectedAttendanceId');

    // Recuperar purpose e purpose_detail do sessionStorage
    const purpose = sessionStorage.getItem('selectedPurpose') || 'Não especificado';
    const purposeDetail = sessionStorage.getItem('selectedPurposeDetail') || '';

    console.log('Valores recuperados do sessionStorage:', { purpose, purposeDetail });

    // Criar um prompt completo com todos os dados
    const fullInitialInput = `${initialInput}\n\nPropósito: ${purpose}\nDetalhes do Propósito: ${purposeDetail}`;

    console.log('Chamando callBotAPI:', {
        fullInitialInput,
        user_id,
        clientIdToLink,
        attendanceId
    });

    toggleSpinner(true);

    let logInitialInput = fullInitialInput;
    if (isNewSessionFlow && clientNameContext) {
        logInitialInput = `(${t('client', 'Cliente')}: ${clientNameContext}) ${fullInitialInput}`;
    }
    addToHistoryAndLog('usuario', logInitialInput);

    let technicalReport = "";
    let medicalResponse = "";
    let strategicResponse = "";
    let finalReport = "";
    let finalSupervisorResponse = "";
    let hasError = false;

    try {
        // Verificar se é uma resposta ao Supervisor ou continuação
        if (AppState.aguardandoRespostaUsuario && !isNewSessionFlow) {
            console.log("Processando resposta ao Supervisor...");
            const supervisorPrompt = `${AppState.historicoConversa}\n\nUsuário: ${fullInitialInput}\n\nSupervisor, por favor, considere a última resposta do usuário e continue a análise ou forneça uma resposta final. Se precisar de mais informações, use '[PEDIDO_INFO]'`;
            finalSupervisorResponse = await callBotAPI("supervisor", supervisorPrompt, currentSessionId, user_id);
            AppState.ultimaMensagemSupervisor = finalSupervisorResponse;
            const isFinalResponse = !finalSupervisorResponse.includes('[PEDIDO_INFO]');
            addToHistoryAndLog('supervisor', finalSupervisorResponse, isFinalResponse);
            renderLogs();
            updateElementVisibility(DOM.downloadPdfBtn, true);
            checkIfSupervisorNeedsInput(finalSupervisorResponse);
            if (DOM.entradaUsuario) DOM.entradaUsuario.value = '';
        } else if (!isNewSessionFlow && AppState.ultimaMensagemSupervisor) {
            console.log("Continuando conversa existente...");
            const supervisorPrompt = `${AppState.historicoConversa}\n\nUsuário: ${fullInitialInput}\n\nSupervisor, por favor, considere a última resposta do usuário e continue a análise ou forneça uma resposta final. Se precisar de mais informações, use '[PEDIDO_INFO]'`;
            finalSupervisorResponse = await callBotAPI("supervisor", supervisorPrompt, currentSessionId, user_id);
            AppState.ultimaMensagemSupervisor = finalSupervisorResponse;
            const isFinalResponse = !finalSupervisorResponse.includes('[PEDIDO_INFO]');
            addToHistoryAndLog('supervisor', finalSupervisorResponse, isFinalResponse);
            renderLogs();
            updateElementVisibility(DOM.downloadPdfBtn, true);
            checkIfSupervisorNeedsInput(finalSupervisorResponse);
            if (DOM.entradaUsuario) DOM.entradaUsuario.value = '';
        } else {
            // Fluxo completo para nova sessão
            console.log("Etapa 1: Chamando Redator para relatório técnico inicial...");
            const redactorRequestMsg = t("supervisorRequestingRedactor");
            addToHistoryAndLog('supervisor', redactorRequestMsg);
            renderLogs();
            technicalReport = await callBotAPI(
                "redator",
                fullInitialInput,
                null,
                user_id,
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
                const isFinalResponse = !finalSupervisorResponse.includes('[PEDIDO_INFO]');
                addToHistoryAndLog('supervisor', finalSupervisorResponse, isFinalResponse);
                renderLogs();
                updateElementVisibility(DOM.downloadPdfBtn, true);
                checkIfSupervisorNeedsInput(finalSupervisorResponse);
                if (DOM.entradaUsuario) DOM.entradaUsuario.value = '';
            } catch (err) {
                console.error("Erro na Etapa 5 (Supervisor):", err);
                showError('errorCallingBot', t('errorCallingBot', `Erro ao chamar Supervisor: ${err.message}`), { role: 'supervisor' });
                hasError = true;
                finalSupervisorResponse = t('errorFetchingSupervisorResponse', 'Erro ao obter resposta final do supervisor.');
                addToHistoryAndLog('supervisor', finalSupervisorResponse);
                renderLogs();
                throw err;
            }
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

function setupEventListeners() {
    const t = i18nInstance && i18nInstance.t ? i18nInstance.t.bind(i18nInstance) : fallbackT;
    DOM.themeToggle?.addEventListener('click', toggleTheme);
    DOM.languageSelect?.addEventListener('click', () => {
        const currentLang = AppState.currentLanguage || 'pt';
        const newLang = currentLang === 'pt' ? 'en' : 'pt';
        i18nInstance.changeLanguage(newLang, (err) => {
            if (err) return console.error('Erro ao mudar idioma:', err);
            AppState.currentLanguage = newLang;
            updateContent(DOM);
        });
    });

    DOM.caseForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const userInput = DOM.entradaUsuario?.value.trim();
        if (!userInput) {
            showError('errorCaseRequired', t('errorCaseRequired', 'Por favor, descreva o caso ou forneça a informação solicitada.'));
            return;
        }
        mainCaseFlow(userInput);
    });

    DOM.clearLogsBtn?.addEventListener('click', handleClearLogs);
    DOM.exportLogsBtn?.addEventListener('click', exportLogs);
    DOM.downloadPdfBtn?.addEventListener('click', downloadConversationAsPdf);

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (event) => {
            event.preventDefault();
            handleLogout();
        });
    } else {
        console.warn("Elemento de logout #logout-link não encontrado.");
    }

    const toggleUser = document.getElementById('toggle-user');
    if (toggleUser) {
        toggleUser.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    } else {
        console.warn("Botão 'Perfil do Cliente' (#toggle-user) não encontrado.");
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

    // Definir t fora do try com fallback
    const t = i18nInstance && i18nInstance.t ? i18nInstance.t.bind(i18nInstance) : fallbackT;

    try {
        initializeDOM();
        if (!DOM.logsIndividuais) {
            console.error("Elemento #logsIndividuais não encontrado após initializeDOM.");
        }

        await initializeI18n();
        updateContent(DOM);

        initializeTheme();

        setupEventListeners();

        const cameFrom = sessionStorage.getItem('cameFrom');
        console.log(`Origem da navegação (cameFrom): ${cameFrom}`);
        const backButton = document.getElementById('back-button');
        if (backButton) {
            if (cameFrom === 'client-sessions') {
                const clientId = sessionStorage.getItem('cameFromClientId');
                const clientName = sessionStorage.getItem('cameFromClientName');
                const attendanceId = sessionStorage.getItem('selectedAttendanceId');
                if (clientId && clientName) {
                    backButton.href = `client-sessions.html?clientId=${encodeURIComponent(clientId)}&clientName=${encodeURIComponent(clientName)}`;
                    console.log(`Botão 'Voltar' configurado para: ${backButton.href}`);
                    // Preencher informações da sidebar
                    const clientInfo = document.getElementById('client-info');
                    const attendanceInfo = document.getElementById('attendance-info');
                    if (clientInfo && attendanceInfo) {
                        clientInfo.innerHTML = `${t('client', 'Cliente')}: <strong>${clientName}</strong>`;
                        attendanceInfo.innerHTML = `${t('attendance', 'Atendimento')}: <strong>${attendanceId || 'Não especificado'}</strong>`;
                    }
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

            const clientInfo = document.getElementById('client-info');
            const attendanceInfo = document.getElementById('attendance-info');
            const attendanceId = sessionStorage.getItem('selectedAttendanceId');
            if (clientInfo && attendanceInfo) {
                clientInfo.innerHTML = `${t('client', 'Cliente')}: <strong>${selectedClientName}</strong>`;
                attendanceInfo.innerHTML = `${t('attendance', 'Atendimento')}: <strong>${attendanceId || 'Não especificado'}</strong>`;
            }

            if (selectedAttendanceDescription) {
                console.log(`Descrição do atendimento encontrada: ${selectedAttendanceDescription.substring(0, 50)}...`);
                sessionStorage.removeItem('selectedAttendanceDescription');
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