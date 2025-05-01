// i18n.js - Configuração e funções do i18next

import { DEFAULT_LANGUAGE } from './config.js';
import { AppState } from './state.js';
import { DOM } from './dom-elements.js';

export const i18nInstance = window.i18next;

const resources = {
    pt: {
      translation: {
        title: "ÉgideGPT",
        caseLabel: "Descreva o caso:",
        caseHelp: "Forneça detalhes como idade, diagnóstico, CID e impacto laboral.",
        errorMessageDefault: "Ocorreu um erro. Tente novamente.",
        errorCaseRequired: "Por favor, descreva o caso antes de enviar.",
        errorResponseRequired: "Por favor, forneça uma resposta antes de enviar.",
        errorNoLogsToExport: "Sem logs para exportar.",
        errorPdfLibNotLoaded: "Biblioteca PDF não carregada.",
        submitText: "Enviar Caso",
        toggleConversaShow: "Ocultar Discussão",
        toggleConversaHide: "Ver Discussão dos Bots",
        supervisorRequest: "Supervisor solicitou informação adicional:",
        responseHelp: "Responda com detalhes para prosseguir com o caso.",
        respondSupervisor: "Responder Supervisor",
        // Chaves relacionadas ao PDF e fluxo atualizadas
        downloadPdf: "Baixar Histórico PDF",
        pdfHistoryTitle: "Histórico da Conversa",
        supervisorRequestingRedactor: "Solicitando ao redator um relatório técnico do caso.",
        supervisorMedicalEvaluation: "Detectada possível situação de incapacidade. Encaminhando para avaliação médica.",
        supervisorNoMedical: "Nenhum indício claro de incapacidade encontrado. Pulando avaliação médica.",
        supervisorConsultingStrategist: "Consultando estrategista jurídico para melhor via de ação.",
        // supervisorFinalPetition: "Encaminhando ao redator as informações finais para elaboração da petição.", // Chave antiga
        supervisorRequestingFinalReport: "Solicitando ao redator um relatório final consolidado.", // Nova chave
        finalResponsePrefix: "✅ Resposta Final",
        userResponsePrefix: "👤 Resposta do Usuário",
        userRespondedSuffix: "Usuário respondeu",
        manualActions: "🔧 Ações Manuais",
        manualRedator: "Redator",
        manualMedico: "Médico",
        manualEstrategista: "Estrategista",
        manualSupervisor: "Supervisor",
        clearLogs: "Limpar logs",
        exportLogs: "Exportar histórico",
        filterLabel: "Filtrar:",
        filterAll: "Todos",
        logPrefixMedico: "🩺 Médico",
        logPrefixRedator: "📝 Redator",
        logPrefixEstrategista: "📊 Estrategista",
        logPrefixSupervisor: "🧑‍⚖️ Supervisor",
        logPrefixUsuario: "👤 Usuário",
        noConversation: "Nenhuma conversa disponível.",
        baseLoadError: "Base {{role}} não carregada.",
        apiError: "Erro na API OpenAI: {{status}}",
        fetchError: "Erro ao buscar dados: {{message}}",
        pdfGeneratedTitle: "Petição Gerada", // Pode manter ou remover se não gerar mais petições
        manualLogSuffix: "(Manual)",
      }
    },
    en: {
      translation: {
        title: "ÉgideGPT",
        caseLabel: "Describe the case:",
        caseHelp: "Provide details such as age, diagnosis, ICD code, and work impact.",
        errorMessageDefault: "An error occurred. Please try again.",
        errorCaseRequired: "Please describe the case before submitting.",
        errorResponseRequired: "Please provide a response before submitting.",
        errorNoLogsToExport: "No logs to export.",
        errorPdfLibNotLoaded: "PDF library not loaded.",
        submitText: "Submit Case",
        toggleConversaShow: "Hide Discussion",
        toggleConversaHide: "View Bots Discussion",
        supervisorRequest: "Supervisor requested additional information:",
        responseHelp: "Provide details to proceed with the case.",
        respondSupervisor: "Respond to Supervisor",
        // Chaves relacionadas ao PDF e fluxo atualizadas
        downloadPdf: "Download History PDF",
        pdfHistoryTitle: "Conversation History",
        supervisorRequestingRedactor: "Requesting the redactor to prepare a technical report for the case.",
        supervisorMedicalEvaluation: "Possible incapacity detected. Forwarding for medical evaluation.",
        supervisorNoMedical: "No clear indication of incapacity found. Skipping medical evaluation.",
        supervisorConsultingStrategist: "Consulting the legal strategist for the best course of action.",
        // supervisorFinalPetition: "Forwarding final information to the redactor to draft the petition.", // Chave antiga
        supervisorRequestingFinalReport: "Requesting the redactor to prepare a final consolidated report.", // Nova chave
        finalResponsePrefix: "✅ Final Response",
        userResponsePrefix: "👤 User Response",
        userRespondedSuffix: "User responded",
        manualActions: "🔧 Manual Actions",
        manualRedator: "Redactor",
        manualMedico: "Doctor",
        manualEstrategista: "Strategist",
        manualSupervisor: "Supervisor",
        clearLogs: "Clear logs",
        exportLogs: "Export history",
        filterLabel: "Filter:",
        filterAll: "All",
        logPrefixMedico: "🩺 Doctor",
        logPrefixRedator: "📝 Redactor",
        logPrefixEstrategista: "📊 Strategist",
        logPrefixSupervisor: "🧑‍⚖️ Supervisor",
        logPrefixUsuario: "👤 User",
        noConversation: "No conversation available.",
        baseLoadError: "Knowledge base {{role}} not loaded.",
        apiError: "OpenAI API Error: {{status}}",
        fetchError: "Error fetching data: {{message}}",
        pdfGeneratedTitle: "Generated Petition", // Pode manter ou remover
        manualLogSuffix: "(Manual)",
      }
    }
};

export function initializeI18n(callback) {
  i18nInstance.init({
    lng: AppState.currentLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    resources: resources,
    debug: false
  }, (err, t) => {
    if (err) {
      console.error('i18next initialization failed:', err);
      return callback(err);
    }
    updateContent();
    callback(null, t);
  });
}

export function updateContent() {
  const t = i18nInstance.t.bind(i18nInstance);

  Object.keys(DOM.i18nElements).forEach(key => {
      const element = DOM.i18nElements[key];
      if (element) {
          if (key.startsWith('manual') && key !== 'manualActions') {
             element.innerHTML = `🔁 ${t(key)}`;
          } else if (key === 'clearLogs' || key === 'exportLogs') {
              const icon = key === 'clearLogs' ? '🗑️ ' : '💾 ';
              element.innerHTML = icon + t(key);
          } else if (key === 'toggleConversa') {
              element.textContent = AppState.mostrarConversa ? t('toggleConversaShow') : t('toggleConversaHide');
          }
           else {
            element.textContent = t(key);
          }
      }
  });

   if(DOM.entradaUsuario) DOM.entradaUsuario.placeholder = t('caseHelp');
   document.title = t('title');
   if (DOM.languageSelect) DOM.languageSelect.value = AppState.currentLanguage;
}

export function changeLanguage(lang) {
  AppState.currentLanguage = lang;
  i18nInstance.changeLanguage(lang, (err, t) => {
    if (err) return console.error('Error changing language:', err);
    updateContent();
  });
}


export function getBotLogPrefix(role) {
  if (!i18nInstance || !i18nInstance.t) {
    console.error("i18nInstance não está pronta em getBotLogPrefix para role:", role);
    return role; // Fallback
  }

  const t = i18nInstance.t.bind(i18nInstance);
  const lowerRole = role ? role.toLowerCase() : 'desconhecido';

  switch(lowerRole) {
    // Usando fallback direto no t() para simplificar
    case 'medico': return t('logPrefixMedico', '🩺 Médico');
    case 'redator': return t('logPrefixRedator', '📝 Redator');
    case 'estrategista': return t('logPrefixEstrategista', '📊 Estrategista');
    case 'supervisor': return t('logPrefixSupervisor', '🧑‍⚖️ Supervisor');
    case 'usuario': return t('logPrefixUsuario', '👤 Usuário');
    default:
      console.warn(`Role não mapeado em getBotLogPrefix: ${role}. Retornando role bruto.`);
      return role;
  }
}

// Removido export default desnecessário
// export default i18nInstance; // Não necessário exportar default se já exporta nomeado
