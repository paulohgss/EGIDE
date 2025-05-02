// frontend/js/logs.js (Versão Final Corrigida)

import { AppState, resetCaseState } from './state.js';
import { DOM } from './dom-elements.js';
import { resetUIForNewCase, updateElementVisibility } from './ui.js'; // Importa updateElementVisibility daqui
import { getBotLogPrefix, i18nInstance } from './i18n.js';

/**
 * Adiciona uma entrada ao histórico de conversa e aos logs da aplicação.
 * Atualiza a exibição dos logs na interface.
 * @param {string} actor 'usuario' ou o nome do bot (e.g., 'redator', 'supervisor').
 * @param {string} text O texto da mensagem.
 */
export function addToHistoryAndLog(actor, text) {
  if (!text) return;

  const timestamp = new Date().toISOString();
  const t = i18nInstance.t.bind(i18nInstance);

  const logRoleName = actor === 'usuario'
    ? t('userLogPrefixSimple', 'Usuário')
    : actor.charAt(0).toUpperCase() + actor.slice(1);
  AppState.logs.push({ bot: logRoleName, texto: text });

  const historyPrefix = actor === 'usuario'
    ? t('userLogPrefix', 'Usuário')
    : getBotLogPrefix(actor);
  AppState.historicoConversa += `${historyPrefix}:\n${text}\n\n`;

  renderLogs();
}


/**
 * Renderiza os logs na interface do usuário, aplicando o filtro atual.
 */
export function renderLogs() {
  if (!DOM.logsIndividuais) return;
  const t = i18nInstance.t.bind(i18nInstance);
  const userLogName = t('userLogPrefixSimple', 'Usuário');

  const filteredLogs = AppState.logs.filter(log =>
    AppState.filtroAtual === 'ALL' || log.bot === AppState.filtroAtual || (AppState.filtroAtual === 'Usuário' && log.bot === userLogName)
  );

  if (filteredLogs.length > 0) {
    DOM.logsIndividuais.innerHTML = filteredLogs.map(log => `
      <div class="log-entry mb-2">
        <strong>${log.bot}:</strong>
        <pre class="log-text">${escapeHtml(log.texto)}</pre>
      </div>
    `).join('');
    updateElementVisibility(DOM.logsIndividuais, true);
  } else {
    DOM.logsIndividuais.innerHTML = '';
    updateElementVisibility(DOM.logsIndividuais, false);
  }
}

/**
 * Limpa o estado do caso, os logs na UI e o session_id salvo.
 */
export function handleClearLogs() {
  const t = i18nInstance.t.bind(i18nInstance);
  // Confirmação opcional antes de limpar
  // if (!confirm(t('confirmClearLogs', 'Tem certeza que deseja limpar o histórico atual?'))) {
  //    return;
  // }
  console.log("Limpando logs e resetando estado...");
  resetCaseState();      // Limpa AppState e localStorage
  resetUIForNewCase();   // Limpa a UI
  renderLogs();          // Renderiza a área de logs (vazia/oculta)
  if (DOM.entradaUsuario) DOM.entradaUsuario.value = ''; // Limpa campo de entrada
  // O resetUIForNewCase já deve esconder a resposta final e botões
}


/**
 * Exporta o histórico da conversa atual como um arquivo de texto.
 */
export function exportLogs() {
  const t = i18nInstance.t.bind(i18nInstance);
  if (!AppState.historicoConversa) {
    alert(t('errorNoHistoryToExport', 'Não há histórico para exportar.'));
    return;
  }
  const blob = new Blob([AppState.historicoConversa], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.download = `historico_egide_${timestamp}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escapa caracteres HTML para exibição segura.
 * @param {string | null | undefined} unsafe Texto potencialmente inseguro.
 * @returns {string} Texto seguro para HTML.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * Formata o histórico do backend (array de objetos) para a string única usada no AppState.
 * @param {Array<Object>} backendHistory Array de objetos do histórico do backend.
 * @returns {string} String formatada do histórico.
 */
export function formatBackendHistoryToString(backendHistory) {
    if (!Array.isArray(backendHistory)) return "";
    const t = i18nInstance.t.bind(i18nInstance);
    return backendHistory.map(entry => {
        let prefix = '';
        let content = entry.content || '';
        if (entry.type === 'user_message_to_bot') {
            prefix = t('userLogPrefix', 'Usuário');
        } else if (entry.type === 'bot_response') {
            prefix = getBotLogPrefix(entry.role);
        } else {
             console.warn("Tipo de entrada desconhecido no histórico do backend:", entry.type);
             return '';
        }
        return `${prefix}:\n${content || ''}`;
    }).filter(Boolean).join('\n\n');
}

/**
 * Formata o histórico do backend (array de objetos) para o array de logs da UI.
 * @param {Array<Object>} backendHistory Array de objetos do histórico do backend.
 * @returns {Array<{bot: string, texto: string}>} Array formatado para AppState.logs.
 */
export function formatBackendHistoryToLogs(backendHistory) {
   if (!Array.isArray(backendHistory)) return [];
   const logs = [];
   const t = i18nInstance.t.bind(i18nInstance);
   const userLogName = t('userLogPrefixSimple', 'Usuário');

   backendHistory.forEach(entry => {
       let logBotName = '';
       let logText = entry.content || '';

       if (entry.type === 'user_message_to_bot') {
            logBotName = userLogName;
            logs.push({ bot: logBotName, texto: logText });
       } else if (entry.type === 'bot_response' && entry.role) {
           logBotName = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
           logs.push({ bot: logBotName, texto: logText });
       }
   });
   return logs;
}

// Nota: Removi a definição duplicada de updateElementVisibility