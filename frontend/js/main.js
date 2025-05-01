// frontend/js/main.js

// Importações (adicione SESSION_ID_STORAGE_KEY e ajuste outras se necessário)
import * as Config from './config.js';
import { AppState, resetCaseState, SESSION_ID_STORAGE_KEY } from './state.js'; // <<< ADICIONADO SESSION_ID_STORAGE_KEY >>>
import { DOM } from './dom-elements.js';
import { showError, toggleSpinner, updateElementVisibility, resetUIForNewCase, showFinalResponse } from './ui.js'; // <<< ADICIONADO showFinalResponse (assumindo que existe ou será criada em ui.js) >>>
import { initializeTheme, toggleTheme } from './theme.js';
import { initializeI18n, updateContent, changeLanguage, getBotLogPrefix, i18nInstance } from './i18n.js';
import { callBotAPI, getSessionHistory } from './api.js';
import { addToHistoryAndLog, renderLogs, handleClearLogs, exportLogs, formatBackendHistoryToLogs, formatBackendHistoryToString } from './logs.js'; // <<< ADICIONADO formatBackendHistoryToLogs e formatBackendHistoryToString >>>
import { downloadConversationAsPdf } from './pdf.js';


// <<< NOVA FUNÇÃO para carregar dados da sessão >>>
/**
 * Carrega os dados de uma sessão existente (histórico, logs) do backend.
 * @param {string} sessionId O ID da sessão a ser carregada.
 */
async function loadSessionData(sessionId) {
  if (!sessionId) return;

  console.log(`Tentando carregar dados para a sessão: ${sessionId}`);
  toggleSpinner(true); // Mostra spinner durante o carregamento
  try {
    const backendHistory = await getSessionHistory(sessionId); // Busca histórico no backend

    if (backendHistory && backendHistory.history && backendHistory.history.length > 0) {
      console.log('Histórico carregado do backend:', backendHistory.history);

      // Popula o estado da aplicação com o histórico carregado
      AppState.historicoConversa = formatBackendHistoryToString(backendHistory.history); // Converte para string única
      AppState.logs = formatBackendHistoryToLogs(backendHistory.history); // Converte para o formato de logs da UI
      AppState.currentSessionId = sessionId; // Confirma o ID da sessão no estado

      // Atualiza a UI
      renderLogs(); // Renderiza os logs carregados

      // Tenta encontrar a última resposta do supervisor para exibir
      const lastSupervisorEntry = [...backendHistory.history].reverse().find(entry => entry.role === 'supervisor');
      if (lastSupervisorEntry) {
         AppState.ultimaMensagemSupervisor = lastSupervisorEntry.content;
         showFinalResponse(AppState.ultimaMensagemSupervisor); // <<< USA A NOVA FUNÇÃO UI >>>
         updateElementVisibility(DOM.downloadPdfBtn, true); // Mostra botão PDF se houver resposta
         checkIfSupervisorNeedsInput(AppState.ultimaMensagemSupervisor); // Verifica se precisa de input
      } else {
         // Se não houver resposta final, talvez limpar a área? Ou deixar como está?
         // updateElementVisibility(DOM.respostaFinal, false);
         // updateElementVisibility(DOM.downloadPdfBtn, false);
      }

      console.log(`Sessão ${sessionId} restaurada.`);

    } else {
      console.log(`Nenhum histórico encontrado para a sessão ${sessionId} ou histórico vazio.`);
      // Se não encontrou histórico no backend, remove o ID inválido do localStorage
      localStorage.removeItem(SESSION_ID_STORAGE_KEY);
      AppState.currentSessionId = null;
    }
  } catch (error) {
    console.error(`Erro ao carregar histórico da sessão ${sessionId}:`, error);
    showError('errorLoadingHistory', 'Erro ao carregar histórico da sessão.'); // Mostra erro na UI
    localStorage.removeItem(SESSION_ID_STORAGE_KEY); // Remove ID inválido se houve erro
    AppState.currentSessionId = null;
  } finally {
    toggleSpinner(false); // Esconde spinner
  }
}


/* === INICIALIZAÇÃO === */
document.addEventListener('DOMContentLoaded', async () => { // <<< Transformado em async >>>
    console.log("Aplicação Multi-Bot Iniciando...");
    initializeTheme();
    initializeI18n(async (err) => { // <<< Callback de i18n também async >>>
        if (err) return;

        setupEventListeners();

        // <<< LÓGICA DE CARREGAMENTO DA SESSÃO >>>
        const savedSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
        if (savedSessionId) {
          console.log(`Encontrado session_id salvo: ${savedSessionId}`);
          await loadSessionData(savedSessionId); // Carrega os dados da sessão
        } else {
          console.log("Nenhum session_id encontrado no localStorage.");
          renderLogs(); // Renderiza logs (vazios inicialmente)
        }
        // <<< FIM DA LÓGICA DE CARREGAMENTO >>>

        if(DOM.languageSelect) DOM.languageSelect.value = AppState.currentLanguage;
    });
});

/* === LÓGICA PRINCIPAL DO FLUXO === */

// ... (função containsKeywords e checkIfSupervisorNeedsInput permanecem iguais) ...

/**
 * Executa o fluxo principal de análise do caso.
 */
async function mainCaseFlow(initialInput) {
  const t = i18nInstance.t.bind(i18nInstance);
  const user_id = localStorage.getItem('user_id') || null; // Tenta obter user_id (para associar histórico)

  // <<< LÓGICA DE GESTÃO DO SESSION_ID >>>
  let currentSessionId = AppState.currentSessionId; // Pega o ID da sessão atual (pode ter sido carregado)

  if (!currentSessionId) {
    // Se não há ID de sessão (nem carregado, nem de interações anteriores nesta página),
    // inicia uma nova sessão.
    console.log("Nenhum session_id ativo. Iniciando nova sessão.");
    resetCaseState(); // Limpa estado anterior E localStorage
    resetUIForNewCase(); // Limpa UI
    renderLogs(); // Garante que logs na UI estejam limpos

    // Gera novo ID de sessão
    currentSessionId = `session_${Date.now()}_${user_id || 'anon'}`;
    AppState.currentSessionId = currentSessionId; // Define no estado global

    // Salva o NOVO session_id no localStorage
    localStorage.setItem(SESSION_ID_STORAGE_KEY, currentSessionId);
    console.log(`Nova sessão iniciada e salva no localStorage: ${currentSessionId}`);

  } else {
    // Se já existe um ID de sessão, apenas continua usando-o.
    // Não limpa o estado nem a UI, pois estamos continuando a sessão.
    console.log(`Continuando sessão existente: ${currentSessionId}`);
    // Poderíamos opcionalmente limpar apenas a resposta final se o usuário reenviar o mesmo caso?
    // updateElementVisibility(DOM.respostaFinal, false);
    // updateElementVisibility(DOM.downloadPdfBtn, false);
  }
  // <<< FIM DA LÓGICA DE GESTÃO DO SESSION_ID >>>

  toggleSpinner(true); // Mostra o spinner

  let medicalResponse = "";
  let strategicResponse = "";
  let technicalReport = "";
  let finalReport = "";
  let finalSupervisorResponse = "";

  // Adiciona a entrada inicial ao histórico e logs (APENAS SE FOR UMA NOVA INTERAÇÃO?)
  // Talvez precise ajustar isso para não adicionar novamente se for um reenvio na mesma sessão.
  // Por ora, vamos manter simples e adicionar sempre.
  addToHistoryAndLog('usuario', initialInput);

  try {
    /* 1) Redator gera Relatório Técnico Inicial */
    addToHistoryAndLog('supervisor', t("supervisorRequestingRedactor"));
    technicalReport = await callBotAPI("redator", initialInput, currentSessionId, user_id); // <<< USA currentSessionId >>>
    addToHistoryAndLog('redator', technicalReport);

    /* 2) Avaliação médica, se necessário */
    const needsMedicalEval = containsKeywords(initialInput, Config.KEYWORDS_INCAPACIDADE);
    if (needsMedicalEval) {
      addToHistoryAndLog('supervisor', t("supervisorMedicalEvaluation"));
      medicalResponse = await callBotAPI("medico", initialInput, currentSessionId, user_id); // <<< USA currentSessionId >>>
      addToHistoryAndLog('medico', medicalResponse);
    } else {
      addToHistoryAndLog('supervisor', t("supervisorNoMedical"));
    }

    /* 3) Estratégia */
    addToHistoryAndLog('supervisor', t("supervisorConsultingStrategist"));
    const strategistInput = `${technicalReport}\n\n${medicalResponse || ''}`.trim();
    strategicResponse = await callBotAPI("estrategista", strategistInput, currentSessionId, user_id); // <<< USA currentSessionId >>>
    addToHistoryAndLog('estrategista', strategicResponse);

    /* 4) Redator gera Relatório Final Consolidado */
    addToHistoryAndLog('supervisor', t("supervisorRequestingFinalReport", "Solicitando ao redator um relatório final consolidado."));
    const finalReportInput = `${technicalReport}\n\n${medicalResponse || ''}\n\n${strategicResponse}`.trim();
    finalReport = await callBotAPI("redator", finalReportInput, currentSessionId, user_id); // <<< USA currentSessionId >>>
    addToHistoryAndLog('redator', `RELATÓRIO FINAL CONSOLIDADO:\n${finalReport}`);

    /* 5) Supervisor consolida e dá resposta final */
    const supervisorInput = `${technicalReport}\n\n${medicalResponse || ''}\n\n${strategicResponse}\n\nRELATÓRIO FINAL CONSOLIDADO DO REDATOR:\n${finalReport}\n\n---\nCom base em todo o histórico e no relatório final consolidado do redator, forneça uma resposta final para o usuário, resumindo a análise e indicando os próximos passos ou a conclusão estratégica.`;
    finalSupervisorResponse = await callBotAPI("supervisor", supervisorInput, currentSessionId, user_id); // <<< USA currentSessionId >>>
    AppState.ultimaMensagemSupervisor = finalSupervisorResponse;
    addToHistoryAndLog('supervisor', finalSupervisorResponse);

    // Exibe a resposta final
    showFinalResponse(finalSupervisorResponse); // <<< USA A NOVA FUNÇÃO UI >>>
    updateElementVisibility(DOM.downloadPdfBtn, true);

    checkIfSupervisorNeedsInput(finalSupervisorResponse);

  } catch (err) {
    console.error("Erro no fluxo principal:", err);
    // O tratamento de erro já ocorre em callBotAPI
  } finally {
    toggleSpinner(false);
  }
}


/**
 * Lida com a execução manual de um bot específico.
 */
async function handleManualBotExecution(role) {
    const user_id = localStorage.getItem('user_id') || null;
    const currentSessionId = AppState.currentSessionId; // <<< LÊ DO ESTADO GLOBAL >>>

    if (!currentSessionId) {
        showError("errorSessionRequired", "Inicie ou recarregue uma análise primeiro."); // Mensagem ajustada
        return;
    }
     if (!AppState.historicoConversa) {
        showError("errorCaseRequired"); // Ou talvez "errorHistoryRequired"?
        return;
    }
    if (!role) {
        console.error("Role não fornecido para execução manual.");
        return;
    }

    toggleSpinner(true);
    try {
        // Usa o histórico COMPLETO atual como input para a chamada manual
        const response = await callBotAPI(role, AppState.historicoConversa, currentSessionId, user_id); // <<< Passa session_id e user_id >>>
        const logRoleName = role.charAt(0).toUpperCase() + role.slice(1);

        // Adiciona a resposta ao histórico e aos logs
        const manualPrefix = `${getBotLogPrefix(role)} ${i18nInstance.t('manualLogSuffix')}`;
        const logEntryText = `(Manual) ${response}`;
        const historyEntryText = `${manualPrefix}:\n${response}\n\n`;

        // Atualiza estado
        AppState.logs.push({ bot: logRoleName, texto: logEntryText });
        AppState.historicoConversa += historyEntryText;

        // Atualiza UI
        renderLogs(); // Atualiza a lista de logs
        showFinalResponse(`${AppState.ultimaMensagemSupervisor || ''}\n\n--- ${manualPrefix} ---\n${response}`); // Anexa à resposta final existente
        updateElementVisibility(DOM.downloadPdfBtn, true);


        if(role === 'supervisor') {
             AppState.ultimaMensagemSupervisor = response; // Atualiza a última msg do supervisor
             checkIfSupervisorNeedsInput(response);
        }

    } catch (err) {
        console.error(`Erro na execução manual do ${role}:`, err);
    } finally {
        toggleSpinner(false);
    }
}


/**
 * Lida com a resposta do usuário quando o supervisor solicita mais informações.
 */
async function handleSupervisorResponse() {
  const userInput = DOM.respostaUsuarioInput?.value.trim();
  if (!userInput) {
    showError("errorResponseRequired");
    return;
  }

  const user_id = localStorage.getItem('user_id') || null;
  const currentSessionId = AppState.currentSessionId; // <<< LÊ DO ESTADO GLOBAL >>>

  if (!currentSessionId) {
      showError("errorSessionRequired", "Sessão não encontrada. Inicie ou recarregue uma análise.");
      return;
  }

  toggleSpinner(true);
  updateElementVisibility(DOM.respostaUsuarioBox, false);
  AppState.aguardandoRespostaUsuario = false;

  addToHistoryAndLog('usuario', userInput); // Adiciona resposta do usuário ao histórico/logs LOCAIS

  try {
    // O contexto para o supervisor é o histórico acumulado ATE AGORA (incluindo a nova resposta do usuário)
    const contextForSupervisor = AppState.historicoConversa;
    const supervisorNewResponse = await callBotAPI("supervisor", contextForSupervisor, currentSessionId, user_id); // <<< Passa session_id e user_id >>>

    AppState.ultimaMensagemSupervisor = supervisorNewResponse;
    addToHistoryAndLog('supervisor', supervisorNewResponse); // Adiciona resposta do supervisor ao histórico/logs LOCAIS

    showFinalResponse(supervisorNewResponse); // <<< USA A NOVA FUNÇÃO UI (sobrescreve a anterior) >>>
    updateElementVisibility(DOM.downloadPdfBtn, true);
    if(DOM.respostaUsuarioInput) DOM.respostaUsuarioInput.value = "";


    checkIfSupervisorNeedsInput(supervisorNewResponse);

  } catch (err) {
    console.error("Erro ao responder ao supervisor:", err);
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
    // Removida a verificação de AppState.aguardandoRespostaUsuario aqui, pois o fluxo pode ser reiniciado
    const userInput = DOM.entradaUsuario?.value.trim();
    if (!userInput) {
      showError('errorCaseRequired');
      return;
    }
    // Se já estiver aguardando resposta, talvez avisar o usuário ou cancelar a espera?
    if (AppState.aguardandoRespostaUsuario) {
        console.warn("Aguardando resposta do usuário, mas novo caso enviado. Cancelando espera.");
        updateElementVisibility(DOM.respostaUsuarioBox, false);
        AppState.aguardandoRespostaUsuario = false;
    }

    mainCaseFlow(userInput); // Inicia ou continua o fluxo principal
  });


  DOM.manualActionButtons?.forEach(button => {
      button.addEventListener('click', () => {
          if (AppState.aguardandoRespostaUsuario) {
              console.warn("Ação manual bloqueada: Aguardando resposta do usuário.");
              showError("errorActionBlocked", "Responda ao supervisor antes de continuar.");
              return;
          }
          const role = button.getAttribute('data-bot-role');
          handleManualBotExecution(role); // Chama ação manual
      });
  });

  DOM.filterSelect?.addEventListener('change', (e) => {
      AppState.filtroAtual = e.target.value;
      renderLogs();
  });

  DOM.clearLogsBtn?.addEventListener('click', () => {
      handleClearLogs(); // handleClearLogs agora deve chamar resetCaseState que limpa localStorage
  });
  DOM.exportLogsBtn?.addEventListener('click', exportLogs);
  DOM.downloadPdfBtn?.addEventListener('click', downloadConversationAsPdf);
  DOM.respondSupervisorBtn?.addEventListener('click', handleSupervisorResponse); // Chama resposta ao supervisor

  console.log("Event listeners configurados.");
}


// <<< Funções auxiliares para formatar histórico (PODEM IR PARA logs.js) >>>

/**
 * Formata o histórico do backend (array de objetos) para a string única usada no AppState.
 * @param {Array<Object>} backendHistory Array de objetos do histórico do backend.
 * @returns {string} String formatada do histórico.
 */
function formatBackendHistoryToString(backendHistory) {
    if (!backendHistory) return "";
    return backendHistory.map(entry => {
        // Adapte conforme a estrutura EXATA retornada pelo backend
        if (entry.type === 'user_message_to_bot') {
            return `Usuário:\n${entry.content}`;
        } else if (entry.type === 'bot_response') {
            const prefix = getBotLogPrefix(entry.role);
            return `${prefix}:\n${entry.content}`;
        }
        return ''; // Ignora entradas desconhecidas
    }).filter(Boolean).join('\n\n');
}


/**
 * Formata o histórico do backend (array de objetos) para o array de logs da UI.
 * @param {Array<Object>} backendHistory Array de objetos do histórico do backend.
 * @returns {Array<{bot: string, texto: string}>} Array formatado para AppState.logs.
 */
function formatBackendHistoryToLogs(backendHistory) {
   if (!backendHistory) return [];
   const logs = [];
   backendHistory.forEach(entry => {
       if (entry.type === 'user_message_to_bot') {
           // Poderíamos adicionar logs de usuário se quiséssemos
           // logs.push({ bot: 'Usuário', texto: entry.content });
       } else if (entry.type === 'bot_response') {
           const roleName = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
           logs.push({ bot: roleName, texto: entry.content });
       }
       // Ignora outros tipos por enquanto
   });
   return logs;
}

// <<< FUNÇÃO AUXILIAR UI (PODE IR PARA ui.js) >>>
/**
 * Mostra a resposta final na UI.
 * @param {string} responseText O texto da resposta final.
 */
 function showFinalResponse(responseText) {
    if (DOM.respostaFinal) {
        const t = i18nInstance.t.bind(i18nInstance);
        // Limpa conteúdo anterior e adiciona o novo
        DOM.respostaFinal.textContent = `${t("finalResponsePrefix")}:\n\n${responseText}`;
        updateElementVisibility(DOM.respostaFinal, true);
    }
 }