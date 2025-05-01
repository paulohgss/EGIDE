// main.js - Ponto de entrada principal da aplicação

import * as Config from './config.js';
import { AppState, resetCaseState } from './state.js';
import { DOM } from './dom-elements.js';
import { showError, toggleSpinner, updateElementVisibility, resetUIForNewCase } from './ui.js';
import { initializeTheme, toggleTheme } from './theme.js';
import { initializeI18n, updateContent, changeLanguage, getBotLogPrefix, i18nInstance } from './i18n.js';
// Removido loadKnowledgeBases da importação de api.js
import { callBotAPI, getSessionHistory } from './api.js';
import { addToHistoryAndLog, renderLogs, handleClearLogs, exportLogs } from './logs.js';
import { downloadConversationAsPdf } from './pdf.js';

/* === INICIALIZAÇÃO === */
document.addEventListener('DOMContentLoaded', () => {
    console.log("Aplicação Multi-Bot Iniciando...");
    initializeTheme();
    initializeI18n((err) => {
        if (err) return;
        // Removido loadKnowledgeBases();
        setupEventListeners();
        renderLogs();
        if(DOM.languageSelect) DOM.languageSelect.value = AppState.currentLanguage;
    });
});

/* === LÓGICA PRINCIPAL DO FLUXO === */

function containsKeywords(text, keywords) {
  if(!text) return false;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

function checkIfSupervisorNeedsInput(supervisorText) {
  if (!supervisorText) return;
  const needsInput = Config.REGEX_PEDIDO_INFO.test(supervisorText);
  AppState.aguardandoRespostaUsuario = needsInput;
  updateElementVisibility(DOM.respostaUsuarioBox, needsInput);
  if (needsInput && DOM.respostaUsuarioInput) {
      DOM.respostaUsuarioInput.focus();
  }
}

/**
 * Executa o fluxo principal de análise do caso.
 */
async function mainCaseFlow(initialInput) {
  const t = i18nInstance.t.bind(i18nInstance);
  // Tenta obter user_id do localStorage (após login, por exemplo)
  const user_id = localStorage.getItem('user_id') || null;
  // Gera um ID de sessão para esta nova análise
  const generated_session_id = `session_${Date.now()}_${user_id || 'anon'}`;
  // <<< AJUSTE: Salva o session_id no estado global >>>
  AppState.currentSessionId = generated_session_id;
  console.log(`Nova sessão iniciada: ${AppState.currentSessionId}`);


  // Tenta carregar histórico (se existir para este user_id e session_id - PODE NÃO EXISTIR PARA NOVAS SESSÕES)
  // Esta lógica pode precisar de ajuste dependendo se queremos RECOMEÇAR ou CONTINUAR sessões
  /*
  if (user_id) {
      const history = await getSessionHistory(AppState.currentSessionId); // Usa o ID da sessão atual
      if (history && history.length > 0) {
          console.log('Histórico carregado:', history);
          // Precisa formatar o histórico do backend para AppState.historicoConversa
          // Exemplo básico:
           AppState.historicoConversa = history.map(entry => `${getBotLogPrefix(entry.role)}:\n${entry.content}`).join('\n\n');
      }
  }
  */
  // Por enquanto, vamos sempre iniciar limpo:
  resetCaseState(); // Garante que logs e histórico estão limpos
  AppState.currentSessionId = generated_session_id; // Redefine após limpar
  resetUIForNewCase();
  renderLogs();
  toggleSpinner(true);

  let medicalResponse = "";
  let strategicResponse = "";
  let technicalReport = "";
  let finalReport = "";
  let finalSupervisorResponse = "";

  // Usa o session ID atual para todas as chamadas
  const currentSessionId = AppState.currentSessionId;

  addToHistoryAndLog('usuario', initialInput);

  try {
    /* 1) Redator gera Relatório Técnico Inicial */
    addToHistoryAndLog('supervisor', t("supervisorRequestingRedactor"));
    technicalReport = await callBotAPI("redator", initialInput, currentSessionId, user_id);
    addToHistoryAndLog('redator', technicalReport);

    /* 2) Avaliação médica, se necessário */
    const needsMedicalEval = containsKeywords(initialInput, Config.KEYWORDS_INCAPACIDADE);
    if (needsMedicalEval) {
      addToHistoryAndLog('supervisor', t("supervisorMedicalEvaluation"));
      medicalResponse = await callBotAPI("medico", initialInput, currentSessionId, user_id);
      addToHistoryAndLog('medico', medicalResponse);
    } else {
      addToHistoryAndLog('supervisor', t("supervisorNoMedical"));
    }

    /* 3) Estratégia */
    addToHistoryAndLog('supervisor', t("supervisorConsultingStrategist"));
    const strategistInput = `${technicalReport}\n\n${medicalResponse || ''}`.trim();
    strategicResponse = await callBotAPI("estrategista", strategistInput, currentSessionId, user_id);
    addToHistoryAndLog('estrategista', strategicResponse);

    /* 4) Redator gera Relatório Final Consolidado */
    addToHistoryAndLog('supervisor', t("supervisorRequestingFinalReport", "Solicitando ao redator um relatório final consolidado."));
    const finalReportInput = `${technicalReport}\n\n${medicalResponse || ''}\n\n${strategicResponse}`.trim();
    finalReport = await callBotAPI("redator", finalReportInput, currentSessionId, user_id);
    addToHistoryAndLog('redator', `RELATÓRIO FINAL CONSOLIDADO:\n${finalReport}`);

    /* 5) Supervisor consolida e dá resposta final */
    const supervisorInput = `${technicalReport}\n\n${medicalResponse || ''}\n\n${strategicResponse}\n\nRELATÓRIO FINAL CONSOLIDADO DO REDATOR:\n${finalReport}\n\n---\nCom base em todo o histórico e no relatório final consolidado do redator, forneça uma resposta final para o usuário, resumindo a análise e indicando os próximos passos ou a conclusão estratégica.`;
    finalSupervisorResponse = await callBotAPI("supervisor", supervisorInput, currentSessionId, user_id);
    AppState.ultimaMensagemSupervisor = finalSupervisorResponse;
    addToHistoryAndLog('supervisor', finalSupervisorResponse);

    // Exibe a resposta final
    if (DOM.respostaFinal) {
        DOM.respostaFinal.textContent = `${t("finalResponsePrefix")}:\n\n${finalSupervisorResponse}`;
    }
    updateElementVisibility(DOM.respostaFinal, true);
    updateElementVisibility(DOM.downloadPdfBtn, true);

    
    checkIfSupervisorNeedsInput(finalSupervisorResponse);

  } catch (err) {
    console.error("Erro no fluxo principal:", err);
    // Tratamento de erro já ocorre em callBotAPI, mas pode adicionar mais aqui se necessário
  } finally {
    toggleSpinner(false);
  }
}

/**
 * Lida com a execução manual de um bot específico.
 */
async function handleManualBotExecution(role) {
    // <<< AJUSTE: Obter user_id e session_id >>>
    const user_id = localStorage.getItem('user_id') || null;
    const currentSessionId = AppState.currentSessionId;

    if (!AppState.historicoConversa) {
        showError("errorCaseRequired");
        return;
    }
     // <<< AJUSTE: Verifica se há uma sessão ativa >>>
     if (!currentSessionId) {
         showError("errorSessionRequired", "Inicie uma nova análise primeiro.");
         return;
     }
    if (!role) {
        console.error("Role não fornecido para execução manual.");
        return;
    }

    toggleSpinner(true);
    try {
        // <<< AJUSTE: Passa session_id e user_id >>>
        const response = await callBotAPI(role, AppState.historicoConversa, currentSessionId, user_id);
        const logRoleName = role.charAt(0).toUpperCase() + role.slice(1);
        AppState.addLog({ bot: logRoleName, texto: `(Manual) ${response}`});
        renderLogs();

        const manualPrefix = `${getBotLogPrefix(role)} ${i18nInstance.t('manualLogSuffix')}`;
        if(DOM.respostaFinal) {
            DOM.respostaFinal.textContent += `\n\n--- ${manualPrefix} ---\n${response}`;
            updateElementVisibility(DOM.respostaFinal, true);
        }
        updateElementVisibility(DOM.downloadPdfBtn, true);

        AppState.historicoConversa += `${manualPrefix}:\n${response}\n\n`;
        

        if(role === 'supervisor') {
             AppState.ultimaMensagemSupervisor = response;
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

  // <<< AJUSTE: Obter user_id e session_id >>>
  const user_id = localStorage.getItem('user_id') || null;
  const currentSessionId = AppState.currentSessionId;

  // <<< AJUSTE: Verifica se há uma sessão ativa >>>
  if (!currentSessionId) {
      showError("errorSessionRequired", "Sessão não encontrada. Inicie uma nova análise.");
      return;
  }


  toggleSpinner(true);
  updateElementVisibility(DOM.respostaUsuarioBox, false);
  AppState.aguardandoRespostaUsuario = false;

  addToHistoryAndLog('usuario', userInput); // Adiciona resposta do usuário ao histórico LOCAL

  try {
    // O contexto para o supervisor é o histórico acumulado ATE AGORA
    const contextForSupervisor = AppState.historicoConversa;
    // <<< AJUSTE: Passa session_id e user_id >>>
    const supervisorNewResponse = await callBotAPI("supervisor", contextForSupervisor, currentSessionId, user_id);

    AppState.ultimaMensagemSupervisor = supervisorNewResponse;
    addToHistoryAndLog('supervisor', supervisorNewResponse); // Adiciona resposta do supervisor ao histórico LOCAL

    if(DOM.respostaFinal) DOM.respostaFinal.textContent = `${i18nInstance.t("finalResponsePrefix")}:\n\n${supervisorNewResponse}`;
    updateElementVisibility(DOM.respostaFinal, true);
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
    if (AppState.aguardandoRespostaUsuario) {
        console.warn("Envio bloqueado: Aguardando resposta do usuário.");
        return;
    }
    const userInput = DOM.entradaUsuario?.value.trim();
    if (!userInput) {
      showError('errorCaseRequired');
      return;
    }
    mainCaseFlow(userInput); // Inicia o fluxo principal
  });


  DOM.manualActionButtons?.forEach(button => {
      button.addEventListener('click', () => {
          const role = button.getAttribute('data-bot-role');
          handleManualBotExecution(role); // Chama ação manual
      });
  });

  DOM.filterSelect?.addEventListener('change', (e) => {
      AppState.filtroAtual = e.target.value;
      renderLogs();
  });

  DOM.clearLogsBtn?.addEventListener('click', handleClearLogs);
  DOM.exportLogsBtn?.addEventListener('click', exportLogs);
  DOM.downloadPdfBtn?.addEventListener('click', downloadConversationAsPdf);
  DOM.respondSupervisorBtn?.addEventListener('click', handleSupervisorResponse); // Chama resposta ao supervisor

  console.log("Event listeners configurados.");
}