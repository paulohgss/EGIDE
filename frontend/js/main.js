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


// Em frontend/js/main.js

/* === INICIALIZAÇÃO === */
document.addEventListener('DOMContentLoaded', async () => {
  console.log("Aplicação Égide Iniciando...");

  const token = localStorage.getItem('token');
  if (!token && !window.location.pathname.endsWith('/login.html') && !window.location.pathname.endsWith('/register.html')) {
      console.log("Nenhum token encontrado, redirecionando para login.");
      window.location.href = 'login.html';
      return;
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

          // Mostra saudação
          const userGreetingElement = document.getElementById('user-greeting');
          const userId = localStorage.getItem('user_id');
          if (token && userGreetingElement && userId) {
              userGreetingElement.textContent = `Olá! (ID: ${userId})`;
              userGreetingElement.classList.remove('d-none');
          }

          setupEventListeners(); // Configura botões ANTES de decidir o que carregar

          // <<< VERIFICA SE VEIO DA PÁGINA DE CLIENTES >>>
          const selectedClientId = sessionStorage.getItem('selectedClientId');
          const selectedClientName = sessionStorage.getItem('selectedClientName');

          if (selectedClientId) {
              // Veio da página de clientes! Prepara para nova análise
              console.log(`Cliente selecionado encontrado: ${selectedClientName} (ID: ${selectedClientId}). Preparando para nova análise.`);
              sessionStorage.removeItem('selectedClientId'); // Limpa para não reutilizar
              sessionStorage.removeItem('selectedClientName');

              localStorage.removeItem(SESSION_ID_STORAGE_KEY); // Remove ID de sessão antiga do localStorage
              AppState.currentSessionId = null; // Garante que o estado não tem ID antigo

              resetCaseState(); // Limpa logs/histórico no AppState (NÃO limpa localStorage de novo)
              resetUIForNewCase(); // Limpa a UI (logs, resposta final)
              renderLogs();

              // Define o cliente pendente para a próxima chamada do mainCaseFlow
              AppState.pendingClientId = selectedClientId;
              AppState.pendingClientName = selectedClientName; // Guarda nome para prompt

              // Ajusta o placeholder da entrada do usuário
              if (DOM.entradaUsuario) {
                  DOM.entradaUsuario.value = '';
                  const placeholderText = `Iniciando análise para o cliente: ${AppState.pendingClientName}.\n\nDescreva o caso ou a pergunta inicial:`;
                  DOM.entradaUsuario.placeholder = placeholderText;
                  DOM.entradaUsuario.focus();
              }

          } else {
              // Não veio da página de clientes, tenta carregar última sessão do localStorage
              console.log("Nenhum cliente selecionado via sessionStorage. Verificando localStorage para sessão anterior...");
              AppState.pendingClientId = null; // Garante que não há cliente pendente
              AppState.pendingClientName = null;
              const savedSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
              if (savedSessionId) {
                  console.log(`Encontrado session_id salvo: ${savedSessionId}. Carregando...`);
                  await loadSessionData(savedSessionId); // Carrega sessão existente
              } else {
                  console.log("Nenhum session_id encontrado no localStorage. Pronto para nova análise genérica.");
                  resetUIForNewCase();
                  renderLogs();
                  if(DOM.entradaUsuario) {
                     DOM.entradaUsuario.placeholder = i18nInstance.t('caseHelp'); // Placeholder padrão
                  }
              }
          }
          // <<< FIM DA VERIFICAÇÃO sessionStorage >>>

          // Define o idioma inicial no select
          if(DOM.languageSelect) DOM.languageSelect.value = AppState.currentLanguage;

      } else {
          console.log(`Página de autenticação (${window.location.pathname}). Lógica principal pulada.`);
      }
  });
}); // Fim do DOMContentLoaded


//Lida com o evento de clique no link/botão de logout.
function handleLogout() {
   console.log("Executando logout...");
   // Remove token e user_id do localStorage
   localStorage.removeItem('token');
   localStorage.removeItem('user_id');
   // Remove o session_id também para não carregar sessão antiga ao logar de novo
   // localStorage.removeItem(SESSION_ID_STORAGE_KEY); // SESSION_ID_STORAGE_KEY precisa estar importado de state.js

   // Redireciona para a página de login
   window.location.href = 'login.html';
}


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
// Em frontend/js/main.js

async function mainCaseFlow(initialInput) {
  const t = i18nInstance.t.bind(i18nInstance);
  const user_id = localStorage.getItem('user_id');

  let currentSessionId = AppState.currentSessionId; // Pode ser null se for nova sessão
  const isNewSessionFlow = !currentSessionId; // É nova se não temos ID no estado

  // Pega o client_id pendente (se viemos da página de clientes)
  const clientIdToLink = AppState.pendingClientId;
  const clientNameContext = AppState.pendingClientName; // Pega o nome também
  AppState.pendingClientId = null; // Limpa para não usar de novo
  AppState.pendingClientName = null;

  // --- Logica de Início da Sessão ---
  if (isNewSessionFlow) {
      console.log(`Iniciando nova sessão ${clientIdToLink ? 'para cliente ' + clientIdToLink : 'genérica'}.`);
      // O ID da sessão será gerado pelo backend e retornado na primeira chamada.
      // AppState.currentSessionId ainda é null.
      // resetCaseState e resetUIForNewCase já foram chamados no DOMContentLoaded se veio de cliente,
      // ou não são necessários se é a primeira interação na página.
      renderLogs(); // Garante que logs estão visíveis (mesmo vazios)
  } else {
      console.log(`Continuando análise na sessão existente: ${currentSessionId}`);
      resetUIForNewCase(); // Limpa só a UI de resultados anteriores
      renderLogs(); // Mostra logs existentes
  }

  toggleSpinner(true);

  // Monta o input inicial para o log local (pode incluir contexto do cliente)
  let logInitialInput = initialInput;
  if (isNewSessionFlow && clientNameContext) {
      logInitialInput = `(Cliente: ${clientNameContext}) ${initialInput}`;
  }
  // Adiciona a entrada ao log/histórico local
  addToHistoryAndLog('usuario', logInitialInput);

  // --- Variaveis do fluxo ---
  let medicalResponse = "", strategicResponse = "", technicalReport = "", finalReport = "", finalSupervisorResponse = "";

  try {
    // 1) Redator -> Relatório Técnico Inicial
    addToHistoryAndLog('supervisor', t("supervisorRequestingRedactor"));
    // Input para o 1º bot: apenas a descrição do usuário (sem prefixo de cliente)
    technicalReport = await callBotAPI(
        "redator",
        initialInput,       // Envia SÓ a descrição do caso
        null,               // Envia null como session_id para indicar NOVA sessão
        user_id,            // Passa user_id logado (backend usará se não for 'anon')
        clientIdToLink      // Passa client_id SOMENTE nesta primeira chamada
    );
    // APÓS a primeira chamada, AppState.currentSessionId deve ter sido atualizado pela API
    currentSessionId = AppState.currentSessionId; // Pega o ID da sessão (novo ou antigo)
    if (!currentSessionId) { // Validação extra
         throw new Error("Falha ao obter/definir o ID da sessão após a primeira chamada API.");
    }
    addToHistoryAndLog('redator', technicalReport);


    // 2) Médico -> Avaliação (se necessário)
    const needsMedicalEval = containsKeywords(initialInput, Config.KEYWORDS_INCAPACIDADE);
    if (needsMedicalEval) {
      addToHistoryAndLog('supervisor', t("supervisorMedicalEvaluation"));
      const medicalInput = `Descrição do Caso:\n${initialInput}\n\nRelatório Técnico Inicial:\n${technicalReport}`;
      // Chamadas seguintes USAM o currentSessionId e NÃO enviam client_id
      medicalResponse = await callBotAPI("medico", medicalInput, currentSessionId, user_id);
      addToHistoryAndLog('medico', medicalResponse);
    } else {
      addToHistoryAndLog('supervisor', t("supervisorNoMedical"));
      medicalResponse = t('noMedicalEvaluationNeeded', 'N/A');
    }

    // 3) Estrategista -> Estratégia
    addToHistoryAndLog('supervisor', t("supervisorConsultingStrategist"));
    const strategistInput = `Descrição do Caso:\n${initialInput}\n\nRelatório Técnico:\n${technicalReport}\n\nAvaliação Médica:\n${medicalResponse || 'Nenhuma realizada'}`;
    strategicResponse = await callBotAPI("estrategista", strategistInput, currentSessionId, user_id);
    addToHistoryAndLog('estrategista', strategicResponse);

    // 4) Redator -> Relatório Final Consolidado
    addToHistoryAndLog('supervisor', t("supervisorRequestingFinalReport"));
    const finalReportInput = `Gere um relatório final consolidado com base nas seguintes informações:\n\nDescrição Original:\n${initialInput}\n\nRelatório Técnico:\n${technicalReport}\n\nAvaliação Médica:\n${medicalResponse || 'Nenhuma realizada'}\n\nEstratégia Jurídica Sugerida:\n${strategicResponse}`;
    finalReport = await callBotAPI("redator", finalReportInput, currentSessionId, user_id);
    addToHistoryAndLog('redator', `RELATÓRIO FINAL CONSOLIDADO:\n${finalReport}`);

    // 5) Supervisor -> Resposta Final / Próximos Passos
    addToHistoryAndLog('supervisor', t("supervisorConsolidating", "Consolidando análise para resposta final..."));
    const supervisorInput = `CONTEXTO COMPLETO:\n${AppState.historicoConversa}\n\n---\nCom base em TODO o histórico acima (incluindo o relatório final consolidado do redator), forneça uma resposta final concisa e clara para o usuário, resumindo a análise e indicando os próximos passos ou a conclusão estratégica. Se precisar de mais informações, peça de forma explícita usando a frase '[PEDIDO_INFO]'.`;
    finalSupervisorResponse = await callBotAPI("supervisor", supervisorInput, currentSessionId, user_id);
    AppState.ultimaMensagemSupervisor = finalSupervisorResponse;
    addToHistoryAndLog('supervisor', finalSupervisorResponse);

    showFinalResponse(finalSupervisorResponse);
    updateElementVisibility(DOM.downloadPdfBtn, true);
    checkIfSupervisorNeedsInput(finalSupervisorResponse);

  } catch (err) {
    console.error("Erro no fluxo principal:", err);
     if (!err.handled) {
         showError('errorProcessingRequest', t('errorProcessingRequest', 'Ocorreu um erro inesperado ao processar o caso.'));
     }
  } finally {
    toggleSpinner(false);
  }
} // Fim de mainCaseFlow

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

  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
      logoutLink.addEventListener('click', (event) => {
          event.preventDefault(); // Previne a navegação padrão do link '#'
          handleLogout();
      });
  } else {
       console.warn("Elemento de logout #logout-link não encontrado.");
  }


  console.log("Event listeners configurados.");
}

 // <<< CHAVE FINAL ESTÁ AQUI >>>