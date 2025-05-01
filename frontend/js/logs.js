// frontend/js/logs.js (Corrigido)

import { AppState, resetCaseState } from './state.js';
import { DOM } from './dom-elements.js';
import { resetUIForNewCase } from './ui.js';
import { getBotLogPrefix, i18nInstance } from './i18n.js'; // <<< Importações corretas >>>

/**
 * Adiciona uma entrada ao histórico de conversa e aos logs da aplicação.
 * Atualiza a exibição dos logs na interface.
 * @param {string} actor 'usuario' ou o nome do bot (e.g., 'redator', 'supervisor').
 * @param {string} text O texto da mensagem.
 */
export function addToHistoryAndLog(actor, text) {
  if (!text) return; // Não adiciona entradas vazias

  const timestamp = new Date().toISOString(); // Opcional: adicionar timestamp se necessário

  // Adiciona aos logs para exibição na UI
  const logRoleName = actor === 'usuario' ? i18nInstance.t('userLogPrefixSimple', 'Usuário') : actor.charAt(0).toUpperCase() + actor.slice(1); // Usar tradução simples para nome do log
  AppState.logs.push({ bot: logRoleName, texto: text });

  // Adiciona ao histórico de conversa (string única) para enviar à API
  const historyPrefix = actor === 'usuario' ? i18nInstance.t('userLogPrefix', 'Usuário') : getBotLogPrefix(actor); // Usa prefixo traduzido ou nome do bot
  AppState.historicoConversa += `${historyPrefix}:\n${text}\n\n`;

  renderLogs(); // Atualiza a exibição dos logs
}


/**
 * Renderiza os logs na interface do usuário, aplicando o filtro atual.
 */
export function renderLogs() {
  if (!DOM.logsIndividuais) return;

  const filteredLogs = AppState.logs.filter(log =>
    AppState.filtroAtual === 'ALL' || log.bot === AppState.filtroAtual || (AppState.filtroAtual === 'Usuário' && log.bot === i18nInstance.t('userLogPrefixSimple', 'Usuário')) // Ajuste para filtrar 'Usuário'
  );

  if (filteredLogs.length > 0) {
    DOM.logsIndividuais.innerHTML = filteredLogs.map(log => `
      <div class="log-entry mb-2">
        <strong>${log.bot}:</strong>
        <pre class="log-text">${escapeHtml(log.texto)}</pre>
      </div>
    `).join('');
    updateElementVisibility(DOM.logsIndividuais, true); // <<< MOVIDO PARA DENTRO DO IF >>>
  } else {
    DOM.logsIndividuais.innerHTML = ''; // Limpa se não houver logs
    updateElementVisibility(DOM.logsIndividuais, false); // <<< MOVIDO PARA DENTRO DO ELSE >>>
  }
}

/**
 * Limpa o estado do caso, os logs na UI e o session_id salvo.
 */
export function handleClearLogs() {
  console.log("Limpando logs e resetando estado...");
  resetCaseState(); // Limpa AppState e localStorage
  resetUIForNewCase(); // Limpa a UI (que agora deve esconder logs vazios)
  renderLogs(); // Renderiza a área de logs (agora vazia e oculta)
  if (DOM.entradaUsuario) DOM.entradaUsuario.value = '';
  if (DOM.respostaFinal) DOM.respostaFinal.textContent = '';
  // UI reset deve cuidar de esconder os elementos
}


/**
 * Exporta o histórico da conversa atual como um arquivo de texto.
 */
export function exportLogs() {
  if (!AppState.historicoConversa) {
    alert(i18nInstance.t('errorNoHistoryToExport', 'Não há histórico para exportar.'));
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
 * @param {string} unsafe Texto potencialmente inseguro.
 * @returns {string} Texto seguro para HTML.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return ''; // Garante que é string
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// <<< FUNÇÃO MOVIDA DE main.js >>>
/**
 * Formata o histórico do backend (array de objetos) para a string única usada no AppState.
 * @param {Array<Object>} backendHistory Array de objetos do histórico do backend.
 * @returns {string} String formatada do histórico.
 */
export function formatBackendHistoryToString(backendHistory) {
    if (!Array.isArray(backendHistory)) return ""; // Verifica se é array
    // Adapte conforme a estrutura EXATA retornada pelo backend no endpoint /api/session-history
    return backendHistory.map(entry => {
        let prefix = '';
        let content = entry.content || '';
        if (entry.type === 'user_message_to_bot') {
            prefix = i18nInstance.t('userLogPrefix', 'Usuário');
        } else if (entry.type === 'bot_response') {
            prefix = getBotLogPrefix(entry.role); // Usa a função de i18n para o nome do bot
        } else {
             console.warn("Tipo de entrada desconhecido no histórico do backend:", entry.type);
             return ''; // Ignora entradas desconhecidas
        }
        // Garante que o conteúdo não seja null/undefined antes de adicionar
        return `${prefix}:\n${content || ''}`;
    }).filter(Boolean).join('\n\n'); // Junta com duas quebras de linha
}

// <<< FUNÇÃO MOVIDA DE main.js >>>
/**
 * Formata o histórico do backend (array de objetos) para o array de logs da UI.
 * @param {Array<Object>} backendHistory Array de objetos do histórico do backend.
 * @returns {Array<{bot: string, texto: string}>} Array formatado para AppState.logs.
 */
export function formatBackendHistoryToLogs(backendHistory) {
   if (!Array.isArray(backendHistory)) return []; // Verifica se é array
   const logs = [];
   // Adapte conforme a estrutura EXATA retornada pelo backend
   backendHistory.forEach(entry => {
       let logBotName = '';
       let logText = entry.content || '';

       if (entry.type === 'user_message_to_bot') {
           // Para consistência, vamos adicionar logs de usuário também
            logBotName = i18nInstance.t('userLogPrefixSimple', 'Usuário');
            logs.push({ bot: logBotName, texto: logText });
       } else if (entry.type === 'bot_response' && entry.role) {
           // Converte role ('redator') para nome capitalizado ('Redator')
           logBotName = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
           logs.push({ bot: logBotName, texto: logText });
       }
   });
   return logs;
}

// <<< REMOVIDA a função updateElementVisibility daqui >>>
// Função auxiliar para visibilidade (deve ser importada de ui.js se necessário)
function updateElementVisibility(element, isVisible) {
    if (element) {
        element.classList.toggle('d-none', !isVisible);
    }
}