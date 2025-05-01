//ui.js 

import { DOM } from './dom-elements.js';
import { AppState } from './state.js';
import { i18nInstance } from './i18n.js';

let errorTimeout = null; // Para garantir que apenas um timeout esteja ativo
let progressTimeout = null; // Para controlar a mensagem de progresso

export function showError(messageKey, fallbackMessage, options = {}) {
  const message = i18nInstance.exists(messageKey)
    ? i18nInstance.t(messageKey, options)
    : fallbackMessage || messageKey;

  DOM.errorMessage.textContent = message;
  DOM.errorMessage.classList.remove('d-none');

  // Limpa timeout anterior se houver
  if (errorTimeout) clearTimeout(errorTimeout);

  // Esconde a mensagem após 5 segundos
  errorTimeout = setTimeout(() => {
      DOM.errorMessage.classList.add('d-none');
      errorTimeout = null;
  }, 5000);
}

/**
 * Exibe uma mensagem de progresso durante requisições longas.
 * @param {string} messageKey - Chave i18n para a mensagem de progresso.
 * @param {string} fallbackMessage - Mensagem padrão se a chave i18n não existir.
 * @param {Object} options - Opções para interpolação (e.g., { role: 'redator' }).
 */
export function showProgress(messageKey, fallbackMessage, options = {}) {
  const message = i18nInstance.exists(messageKey)
    ? i18nInstance.t(messageKey, options)
    : fallbackMessage || messageKey;

  DOM.errorMessage.textContent = message;
  DOM.errorMessage.classList.remove('d-none', 'text-danger'); // Remove estilo de erro
  DOM.errorMessage.classList.add('text-info'); // Estilo de informação

  // Limpa timeout anterior de progresso, se houver
  if (progressTimeout) clearTimeout(progressTimeout);

  // A mensagem de progresso permanece até ser explicitamente limpa
}

/**
 * Limpa a mensagem de progresso exibida por showProgress.
 */
export function clearProgress() {
  if (progressTimeout) {
    clearTimeout(progressTimeout);
    progressTimeout = null;
  }
  DOM.errorMessage.classList.add('d-none');
  DOM.errorMessage.classList.remove('text-info'); // Remove estilo de informação
}

export function toggleSpinner(show) {
  DOM.submitSpinner?.classList.toggle('d-none', !show);
  if (DOM.submitButton) DOM.submitButton.disabled = show;
}

export function updateElementVisibility(element, show) {
    element?.classList.toggle('d-none', !show);
}



export function resetUIForNewCase() {
    // Limpa campos e áreas de resultado
    if (DOM.entradaUsuario) DOM.entradaUsuario.value = '';
    if (DOM.respostaFinal) DOM.respostaFinal.textContent = '';
    if (DOM.conversaInterna) DOM.conversaInterna.textContent = '';
    if (DOM.respostaUsuarioInput) DOM.respostaUsuarioInput.value = '';

    // Esconde elementos dinâmicos
    updateElementVisibility(DOM.respostaFinal, false);
    updateElementVisibility(DOM.downloadPdfBtn, false);
    updateElementVisibility(DOM.conversaInterna, false);
    updateElementVisibility(DOM.respostaUsuarioBox, false);
    updateElementVisibility(DOM.logsIndividuais, false); // Esconde logs também
    if(DOM.errorMessage) DOM.errorMessage.classList.add('d-none'); // Esconde msg de erro

     // Reseta filtro visualmente para 'Todos' (o estado já é resetado em state.js se necessário)
     if (DOM.filterSelect) DOM.filterSelect.value = "ALL";
}

// Função auxiliar para verificar se um elemento existe antes de operar sobre ele
function safeUpdate(element, action) {
    if (element) {
        action(element);
    } else {
        console.warn("Tentativa de operar em elemento DOM nulo:", element);
    }
}