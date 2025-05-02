// main.js - Ponto de entrada principal da aplicação (Versão Final Corrigida e Completa)

import * as Config from './config.js';
import { AppState, resetCaseState, SESSION_ID_STORAGE_KEY } from './state.js';
import { DOM } from './dom-elements.js';
import { showError, toggleSpinner, updateElementVisibility, resetUIForNewCase, showFinalResponse, clearProgress, showProgress } from './ui.js'; // Adicionado clearProgress, showProgress
import { initializeTheme, toggleTheme } from './theme.js';
import { initializeI18n, updateContent, changeLanguage, getBotLogPrefix, i18nInstance } from './i18n.js';
import { callBotAPI, getSessionHistory } from './api.js';
import { addToHistoryAndLog, renderLogs, handleClearLogs, exportLogs, formatBackendHistoryToLogs, formatBackendHistoryToString } from './logs.js';
import { downloadConversationAsPdf } from './pdf.js';


/**
 * Carrega os dados de uma sessão existente (histórico, logs) do backend.
 * @param {string} sessionId O ID da sessão a ser carregada.
 */
async function loadSessionData(sessionId) {
  if (!sessionId) return;

  console.log(`Tentando carregar dados para a sessão: ${sessionId}`);
  showProgress('infoLoadingHistory', 'Carregando histórico...'); // Mensagem de progresso
  toggleSpinner(true); // Mostra spinner geral (desabilita botões)
  try {
    const sessionData = await getSessionHistory(sessionId); // Busca histórico no backend

    // O backend retorna { history: [...] } ou um array vazio diretamente em caso de 404.
    const backendHistory = sessionData?.history || sessionData || []; // Trata ambos os casos

    if (Array.isArray(backendHistory) && backendHistory.length > 0) {
      console.log('Histórico carregado do backend:', backendHistory);

      AppState.historicoConversa = formatBackendHistoryToString(backendHistory);
      AppState.logs = formatBackendHistoryToLogs(backendHistory);
      AppState.currentSessionId = sessionId; // Confirma o ID no estado

      renderLogs(); // Renderiza logs carregados

      const lastSupervisorEntry = [...backendHistory].reverse().find(
          entry => entry.type === 'bot_response' && entry.role === 'supervisor'
      );

      if (lastSupervisorEntry?.content) {
         AppState.ultimaMensagemSupervisor = lastSupervisorEntry.content;
         showFinalResponse(AppState.ultimaMensagemSupervisor);
         updateElementVisibility(DOM.downloadPdfBtn, true);
         checkIfSupervisorNeedsInput(AppState.ultimaMensagemSupervisor);
      } else {
         // Garante que a área de resposta final esteja limpa e oculta se não houver resposta final no histórico
         if(DOM.respostaFinal) DOM.respostaFinal.textContent = '';
         updateElementVisibility(DOM.respostaFinal, false);
         updateElementVisibility(DOM.downloadPdfBtn, false);
      }
      console.log(`Sessão ${sessionId} restaurada.`);
    } else {
      console.log(`Nenhum histórico encontrado para a sessão ${sessionId} ou histórico vazio.`);
      localStorage.removeItem(SESSION_ID_STORAGE_KEY); // Limpa ID inválido
      AppState.currentSessionId = null;
      resetUIForNewCase(); // Garante UI limpa
      renderLogs(); // Garante que logs (vazios) sejam renderizados (e escondidos por resetUI)
    }
  } catch (error) {
    console.error(`Erro ao carregar histórico da sessão ${sessionId}:`, error);
    // showError já é chamado dentro de getSessionHistory em caso de erro de fetch/status
    // Apenas garante a limpeza do estado local
    localStorage.removeItem(SESSION_ID_STORAGE_KEY);
    AppState.currentSessionId = null;
    resetUIForNewCase();
    renderLogs();
  } finally {
    clearProgress(); // Limpa a mensagem de progresso
    toggleSpinner(false); // Libera botões
  }
}


/* === INICIALIZAÇÃO === */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Aplicação Égide Iniciando..."); // Nome atualizado
    initializeTheme();
    initializeI18n(async (err) => { // Callback de i18n async
        if (err) {
             console.error("Falha ao inicializar i18n:", err);
             // Poderia mostrar um erro fatal aqui
             return;
        }

        setupEventListeners(); // Configura os botões e inputs

        const savedSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
        if (savedSessionId) {
          console.log(`Encontrado session_id salvo: ${savedSessionId}`);
          await loadSessionData(savedSessionId); // Tenta carregar a sessão anterior
        } else {
          console.log("Nenhum session_id encontrado no localStorage.");
          resetUIForNewCase(); // Garante que a UI está limpa
          renderLogs(); // Renderiza (esconde) a área de logs
        }

        // Define o idioma inicial no select (após i18n carregar)
        if(DOM.languageSelect) DOM.languageSelect.value = AppState.currentLanguage;
    });
});

/* === LÓGICA PRINCIPAL DO FLUXO === */

/**
 * Verifica se um texto contém alguma das palavras-chave (ignorando maiúsculas/minúsculas).
 * @param {string | null | undefined} text Texto a ser verificado.
 * @param {string[]} keywords Array de palavras-chave.
 * @returns {boolean} True se alguma palavra-chave for encontrada.
 */
function containsKeywords(text, keywords) {
  if(!text) return false;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Verifica se a última mensagem do supervisor contém um pedido de informação
 * e atualiza a UI para mostrar/esconder a caixa de resposta do usuário.
 * @param {string | null | undefined} supervisorText Texto da última mensagem do supervisor.
 */
function checkIfSupervisorNeedsInput(supervisorText) {
  const t = i18nInstance.t.bind(i18nInstance);
  if (!supervisorText) {
      AppState.aguardandoRespostaUsuario = false;
      updateElementVisibility(DOM.respostaUsuarioBox, false);
      return;
  }
  // Usar REGEX do config.js
  const needsInput = Config.REGEX_PEDIDO_INFO.test(supervisorText);
  AppState.aguardandoRespostaUsuario = needsInput;
  updateElementVisibility(DOM.respostaUsuarioBox, needsInput);

  if (needsInput) {
     if (DOM.respostaUsuarioInput) {
          DOM.respostaUsuarioInput.focus();
          DOM.respostaUsuarioInput.placeholder = t('supervisorResponsePlaceholder', 'Digite a informação solicitada aqui...');
     }
     // Opcional: Exibir a pergunta exata do supervisor
     // if (DOM.supervisorRequestQuestionElement) { // Se criar um elemento para isso
     //    DOM.supervisorRequestQuestionElement.textContent = supervisorText.match(Config.REGEX_PEDIDO_INFO)[0] || "Informação necessária";
     // }
  }
}

/**
 * Executa o fluxo principal de análise do caso, chamando os bots em sequência.
 * @param {string} initialInput A descrição inicial do caso fornecida pelo usuário.
 */
async function mainCaseFlow(initialInput) {
  const t = i18nInstance.t.bind(i18nInstance);
  const user_id = localStorage.getItem('user_id') || null; // Tenta obter user_id (do login futuro)

  let currentSessionId = AppState.currentSessionId;

  // Se não há ID de sessão ATIVO, inicia uma nova.
  // Isso acontecerá na primeira vez ou se o usuário limpar os logs.
  if (!currentSessionId) {
    console.log("Nenhum session_id ativo. Iniciando nova sessão.");
    resetCaseState();      // Limpa estado (logs, histórico, session ID) E localStorage
    resetUIForNewCase();   // Limpa UI (exceto entrada do usuário que acabou de ser digitada)
    renderLogs();          // Renderiza/esconde área de logs

    currentSessionId = `session_${Date.now()}_${user_id || 'anon'}`;
    AppState.currentSessionId = currentSessionId;
    localStorage.setItem(SESSION_ID_STORAGE_KEY, currentSessionId);
    console.log(`Nova sessão iniciada e salva no localStorage: ${currentSessionId}`);
  } else {
    // Se JÁ EXISTE uma sessão, apenas continua usando o ID.
    // Limpa a UI para mostrar os resultados da NOVA análise nesta sessão.
    console.log(`Continuando análise na sessão existente: ${currentSessionId}`);
    resetUIForNewCase();   // Limpa resultados anteriores na UI
    renderLogs();          // Mostra logs existentes da sessão
  }

  toggleSpinner(true); // Mostra spinner e desabilita botões

  // Adiciona a entrada inicial do usuário ao histórico e logs da sessão atual
  addToHistoryAndLog('usuario', initialInput);

  let medicalResponse = "";
  let strategicResponse = "";
  let technicalReport = "";
  let finalReport = "";
  let finalSupervisorResponse = "";

  try {
    /* 1) Redator -> Relatório Técnico Inicial */
    addToHistoryAndLog('supervisor', t("supervisorRequestingRedactor"));
    // Input para Redator: apenas a descrição inicial
    technicalReport = await callBotAPI("redator", initialInput, currentSessionId, user_id);
    addToHistoryAndLog('redator', technicalReport);

    /* 2) Médico -> Avaliação (se necessário) */
    const needsMedicalEval = containsKeywords(initialInput, Config.KEYWORDS_INCAPACIDADE);
    if (needsMedicalEval) {
      addToHistoryAndLog('supervisor', t("supervisorMedicalEvaluation"));
      // Input para Médico: descrição inicial + relatório técnico
      const medicalInput = `Descrição do Caso:\n${initialInput}\n\nRelatório Técnico Inicial:\n${technicalReport}`;
      medicalResponse = await callBotAPI("medico", medicalInput, currentSessionId, user_id);
      addToHistoryAndLog('medico', medicalResponse);
    } else {
      addToHistoryAndLog('supervisor', t("supervisorNoMedical"));
      medicalResponse = t('noMedicalEvaluationNeeded', 'N/A'); // Adiciona indicação no histórico
    }

    /* 3) Estrategista -> Estratégia */
    addToHistoryAndLog('supervisor', t("supervisorConsultingStrategist"));
    // Input para Estrategista: descrição + técnico + médico
    const strategistInput = `Descrição do Caso:\n${initialInput}\n\nRelatório Técnico:\n${technicalReport}\n\nAvaliação Médica:\n${medicalResponse || 'Nenhuma realizada'}`;
    strategicResponse = await callBotAPI("estrategista", strategistInput, currentSessionId, user_id);
    addToHistoryAndLog('estrategista', strategicResponse);

    /* 4) Redator -> Relatório Final Consolidado */
    addToHistoryAndLog('supervisor', t("supervisorRequestingFinalReport"));
    // Input para Redator (Final): descrição + técnico + médico + estratégia
    const finalReportInput = `Gere um relatório final consolidado com base nas seguintes informações:\n\nDescrição Original:\n${initialInput}\n\nRelatório Técnico:\n${technicalReport}\n\nAvaliação Médica:\n${medicalResponse || 'Nenhuma realizada'}\n\nEstratégia Jurídica Sugerida:\n${strategicResponse}`;
    finalReport = await callBotAPI("redator", finalReportInput, currentSessionId, user_id);
    // Adiciona prefixo claro ao log
    addToHistoryAndLog('redator', `RELATÓRIO FINAL CONSOLIDADO:\n${finalReport}`);

    /* 5) Supervisor -> Resposta Final / Próximos Passos */
    addToHistoryAndLog('supervisor', t("supervisorConsolidating", "Consolidando análise para resposta final..."));
    // Input para Supervisor (Final): TODO o contexto acumulado
    const supervisorInput = `CONTEXTO COMPLETO:\n${AppState.historicoConversa}\n\n---\nCom base em TODO o histórico acima (incluindo o relatório final consolidado do redator), forneça uma resposta final concisa e clara para o usuário, resumindo a análise e indicando os próximos passos ou a conclusão estratégica. Se precisar de mais informações, peça de forma explícita usando a frase '[PEDIDO_INFO]'.`;
    finalSupervisorResponse = await callBotAPI("supervisor", supervisorInput, currentSessionId, user_id);
    AppState.ultimaMensagemSupervisor = finalSupervisorResponse; // Guarda a última resposta
    addToHistoryAndLog('supervisor', finalSupervisorResponse); // Adiciona ao histórico

    // Exibe a resposta final na UI
    showFinalResponse(finalSupervisorResponse);
    updateElementVisibility(DOM.downloadPdfBtn, true); // Mostra botão de PDF

    checkIfSupervisorNeedsInput(finalSupervisorResponse); // Verifica se pede mais info

  } catch (err) {
    console.error("Erro no fluxo principal:", err);
    // Erros específicos já são mostrados por callBotAPI/getSessionHistory.
    // Podemos mostrar um erro genérico aqui se a exceção não foi tratada lá.
     if (!err.handled) { // Adicionar 'handled' property nos erros tratados pode ajudar
         showError('errorProcessingRequest', t('errorProcessingRequest', 'Ocorreu um erro inesperado ao processar o caso.'));
     }
  } finally {
    toggleSpinner(false); // Esconde spinner e reabilita botões
  }
}


/**
 * Lida com a execução manual de um bot específico.
 * @param {string | null} role O papel do bot a ser executado.
 */
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
        // Input para chamada manual: TODO o histórico atual
        const response = await callBotAPI(role, AppState.historicoConversa, currentSessionId, user_id);

        const manualLogText = `(${t('manualLogSuffix', 'Manual')}) ${response}`;
        addToHistoryAndLog(role, manualLogText); // Adiciona ao log e histórico

        // Se for supervisor, atualiza a última mensagem e a resposta final
        if (role === 'supervisor') {
             AppState.ultimaMensagemSupervisor = response;
             showFinalResponse(response); // Mostra SÓ a resposta manual do supervisor
             checkIfSupervisorNeedsInput(response);
        } else {
            // Para outros bots, podemos opcionalmente anexar à resposta final visível
            // const currentFinalDisplay = DOM.respostaFinal?.textContent || '';
            // showFinalResponse(`${currentFinalDisplay}\n\n--- ${getBotLogPrefix(role)} (Manual) ---\n${response}`);
            // Ou simplesmente não atualizar a área de resposta final para bots não-supervisores
        }
        updateElementVisibility(DOM.downloadPdfBtn, true);

    } catch (err) {
        console.error(`Erro na execução manual do ${role}:`, err);
        // Erro já deve ser mostrado por callBotAPI
    } finally {
        toggleSpinner(false);
    }
}


/**
 * Lida com a resposta do usuário quando o supervisor solicita mais informações.
 */
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
  updateElementVisibility(DOM.respostaUsuarioBox, false); // Esconde a caixa de resposta
  AppState.aguardandoRespostaUsuario = false;

  // Adiciona a resposta do usuário ao histórico/log LOCAL ANTES de enviar
  const userResponseLogText = `(${t('responseToSupervisorSuffix', 'Resposta para Supervisor')}) ${userInput}`;
  addToHistoryAndLog('usuario', userResponseLogText);

  try {
    // O contexto para o supervisor é o histórico acumulado, incluindo a resposta recém-adicionada
    const contextForSupervisor = AppState.historicoConversa;
    // Adiciona instrução explícita para o supervisor considerar a última entrada
    const supervisorPrompt = `${contextForSupervisor}\n\n---\nSupervisor, por favor, considere a última resposta do usuário e continue a análise ou forneça uma resposta final. Se precisar de mais informações, use '[PEDIDO_INFO]'.`;

    const supervisorNewResponse = await callBotAPI("supervisor", supervisorPrompt, currentSessionId, user_id);

    AppState.ultimaMensagemSupervisor = supervisorNewResponse; // Atualiza a última resposta
    addToHistoryAndLog('supervisor', supervisorNewResponse); // Adiciona ao histórico/log

    showFinalResponse(supervisorNewResponse); // Atualiza a resposta final na UI
    updateElementVisibility(DOM.downloadPdfBtn, true);
    if (DOM.respostaUsuarioInput) DOM.respostaUsuarioInput.value = ""; // Limpa o input

    checkIfSupervisorNeedsInput(supervisorNewResponse); // Verifica se pede mais info de novo

  } catch (err) {
    console.error("Erro ao responder ao supervisor:", err);
    // Erro já deve ser mostrado por callBotAPI
    // Podemos reabilitar a caixa de resposta se a API falhar?
    // updateElementVisibility(DOM.respostaUsuarioBox, true);
    // AppState.aguardandoRespostaUsuario = true;
  } finally {
    toggleSpinner(false);
  }
}


/* === CONFIGURAÇÃO DOS EVENT LISTENERS === */
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
    // Impede iniciar novo fluxo completo se estiver aguardando resposta específica
    if (AppState.aguardandoRespostaUsuario) {
        console.warn("Envio de novo caso bloqueado: Aguardando resposta do usuário.");
        showError("errorInputBlocked", t("errorInputBlocked", "Responda à solicitação do supervisor antes de enviar um novo caso."));
        return;
    }
    mainCaseFlow(userInput); // Inicia fluxo principal
  });

  DOM.manualActionButtons?.forEach(button => {
      button.addEventListener('click', () => {
          const t = i18nInstance.t.bind(i18nInstance);
          // Impede ação manual se estiver aguardando resposta específica
          if (AppState.aguardandoRespostaUsuario) {
              console.warn("Ação manual bloqueada: Aguardando resposta do usuário.");
              showError("errorActionBlocked", t("errorActionBlocked", "Responda ao supervisor antes de continuar."));
              return;
          }
          const role = button.getAttribute('data-bot-role');
          handleManualBotExecution(role); // Chama ação manual
      });
  });

  DOM.filterSelect?.addEventListener('change', (e) => {
      AppState.filtroAtual = e.target.value;
      renderLogs(); // Re-renderiza os logs com o novo filtro
  });

  // Associa handleClearLogs (de logs.js) ao botão de limpar
  DOM.clearLogsBtn?.addEventListener('click', handleClearLogs);
  DOM.exportLogsBtn?.addEventListener('click', exportLogs);
  DOM.downloadPdfBtn?.addEventListener('click', downloadConversationAsPdf);
  DOM.respondSupervisorBtn?.addEventListener('click', handleSupervisorResponse); // Botão para responder ao supervisor

  console.log("Event listeners configurados.");
} // <<< CHAVE FINAL ESTÁ AQUI >>>