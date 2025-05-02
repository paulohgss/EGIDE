// frontend/js/ui.js (Versão Final Corrigida)

import { DOM } from './dom-elements.js';
import { AppState } from './state.js';
import { i18nInstance } from './i18n.js';

let errorTimeout = null; // Para garantir que apenas um timeout esteja ativo
let progressTimeout = null; // Para controlar a mensagem de progresso

/**
 * Mostra uma mensagem de erro temporária na UI.
 * @param {string} messageKey Chave i18n para a mensagem.
 * @param {string} [fallbackMessage] Mensagem padrão se a chave não for encontrada.
 * @param {object} [options] Opções para interpolação i18n.
 */
export function showError(messageKey, fallbackMessage, options = {}) {
  const message = i18nInstance.exists(messageKey)
    ? i18nInstance.t(messageKey, options)
    : fallbackMessage || messageKey || i18nInstance.t('errorMessageDefault', 'Ocorreu um erro.');

  if (DOM.errorMessage) {
      DOM.errorMessage.textContent = message;
      DOM.errorMessage.classList.remove('d-none', 'text-info'); // Garante que não tem classe de info
      DOM.errorMessage.classList.add('text-danger'); // Adiciona classe de erro
  }

  if (errorTimeout) clearTimeout(errorTimeout);

  errorTimeout = setTimeout(() => {
      if (DOM.errorMessage) DOM.errorMessage.classList.add('d-none');
      errorTimeout = null;
  }, 5000);
}

/**
 * Exibe uma mensagem de progresso/informação na UI.
 * @param {string} messageKey Chave i18n.
 * @param {string} [fallbackMessage] Mensagem padrão.
 * @param {object} [options] Opções para i18n.
 */
export function showProgress(messageKey, fallbackMessage, options = {}) {
  const message = i18nInstance.exists(messageKey)
    ? i18nInstance.t(messageKey, options)
    : fallbackMessage || messageKey;

  if (DOM.errorMessage) {
    DOM.errorMessage.textContent = message;
    DOM.errorMessage.classList.remove('d-none', 'text-danger');
    DOM.errorMessage.classList.add('text-info');
  }
  if (progressTimeout) clearTimeout(progressTimeout);
}

/**
 * Limpa a mensagem de progresso/informação.
 */
export function clearProgress() {
  if (progressTimeout) {
    clearTimeout(progressTimeout);
    progressTimeout = null;
  }
   if (DOM.errorMessage && DOM.errorMessage.classList.contains('text-info')) { // Só limpa se for mensagem de progresso
       DOM.errorMessage.classList.add('d-none');
       DOM.errorMessage.classList.remove('text-info');
   }
}

/**
 * Controla a exibição do spinner no botão de submit e o estado de desabilitado.
 * @param {boolean} show True para mostrar o spinner, false para esconder.
 */
export function toggleSpinner(show) {
  DOM.submitSpinner?.classList.toggle('d-none', !show);
  if (DOM.submitButton) DOM.submitButton.disabled = show;
  // Desabilitar botões manuais também enquanto processa?
  DOM.manualActionButtons?.forEach(btn => btn.disabled = show);
  if (DOM.respondSupervisorBtn) DOM.respondSupervisorBtn.disabled = show;
}

/**
 * Alterna a visibilidade de um elemento adicionando/removendo a classe 'd-none'.
 * @param {HTMLElement | null} element O elemento do DOM.
 * @param {boolean} show True para mostrar, false para esconder.
 */
export function updateElementVisibility(element, show) {
    element?.classList.toggle('d-none', !show);
}

/**
 * Reseta a interface para o estado inicial de um novo caso.
 */
export function resetUIForNewCase() {
    if (DOM.entradaUsuario) DOM.entradaUsuario.value = '';
    if (DOM.respostaFinal) DOM.respostaFinal.textContent = '';
    // if (DOM.conversaInterna) DOM.conversaInterna.textContent = ''; // Se existir esse elemento
    if (DOM.respostaUsuarioInput) DOM.respostaUsuarioInput.value = '';

    updateElementVisibility(DOM.respostaFinal, false);
    updateElementVisibility(DOM.downloadPdfBtn, false);
    // updateElementVisibility(DOM.conversaInterna, false); // Se existir
    updateElementVisibility(DOM.respostaUsuarioBox, false);
    updateElementVisibility(DOM.logsIndividuais, false);
    if (DOM.errorMessage) DOM.errorMessage.classList.add('d-none');

    if (DOM.filterSelect) DOM.filterSelect.value = "ALL";

    // Garante que o spinner não está ativo e botões estão habilitados
    toggleSpinner(false);
}

/**
 * Mostra a resposta final na UI, formatada e escapada.
 * @param {string} responseText O texto da resposta final.
 */
 export function showFinalResponse(responseText) {
    if (DOM.respostaFinal) {
        const t = i18nInstance.t.bind(i18nInstance);
        const prefix = t("finalResponsePrefix", "✅ Resposta Final");
        // Usar innerHTML permite usar <pre> para manter a formatação, mas requer escapar o conteúdo
        DOM.respostaFinal.innerHTML = `<strong>${prefix}:</strong><pre class="log-text">${escapeHtml(responseText)}</pre>`;
        updateElementVisibility(DOM.respostaFinal, true);
    }
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