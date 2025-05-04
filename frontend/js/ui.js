import { DOM } from './dom-elements.js';
import { AppState } from './state.js';
import { i18nInstance } from './i18n.js';

let errorTimeout = null;
let progressTimeout = null;

/**
 * Mapeia códigos de erro HTTP para chaves i18n.
 * @param {number} status Código de status HTTP.
 * @param {string} defaultMessage Mensagem padrão do backend.
 * @returns {string} Chave i18n correspondente.
 */
function mapErrorToI18nKey(status, defaultMessage) {
  switch (status) {
    case 400:
      if (defaultMessage.includes('obrigatórios')) return 'errorFieldsRequired';
      if (defaultMessage.includes('CPF inválido')) return 'errorInvalidCpf';
      if (defaultMessage.includes('Data de Nascimento')) return 'errorInvalidDob';
      return 'errorBadRequest';
    case 401:
      return 'errorUnauthorized';
    case 403:
      return 'errorForbidden';
    case 404:
      if (defaultMessage.includes('Cliente não encontrado')) return 'errorClientNotFound';
      if (defaultMessage.includes('Histórico da sessão')) return 'errorSessionNotFound';
      return 'errorNotFound';
    case 409:
      if (defaultMessage.includes('CPF já existe')) return 'errorCpfExists';
      if (defaultMessage.includes('Nome de usuário')) return 'errorUsernameTaken';
      return 'errorConflict';
    case 500:
      return 'errorInternalServer';
    case 504:
      if (defaultMessage.includes('IA demorou muito')) return 'errorGatewayTimeout';
      return 'errorGatewayTimeout';
    default:
      return 'errorMessageDefault';
  }
}

/**
 * Mostra uma mensagem de erro temporária na UI.
 * @param {string} messageKey Chave i18n para a mensagem.
 * @param {string} [fallbackMessage] Mensagem padrão se a chave não for encontrada.
 * @param {object} [options] Opções para interpolação i18n e configurações adicionais.
 */
export function showError(messageKey, fallbackMessage, options = {}) {
  const status = options.status;
  const backendMessage = fallbackMessage || messageKey;

  const isI18nReady = i18nInstance && typeof i18nInstance.exists === 'function' && typeof i18nInstance.t === 'function';
  let message;
  if (isI18nReady) {
    const i18nKey = status ? mapErrorToI18nKey(status, backendMessage) : messageKey;
    message = i18nInstance.exists(i18nKey)
      ? i18nInstance.t(i18nKey, options)
      : backendMessage || i18nInstance.t('errorMessageDefault', 'Ocorreu um erro.');
  } else {
    console.warn("i18nInstance não está inicializado. Usando mensagem padrão.");
    message = backendMessage || 'Ocorreu um erro.';
  }

  if (DOM.errorMessage) {
    const errorType = options.status >= 500 ? 'danger' : 'warning';
    DOM.errorMessage.textContent = message;
    DOM.errorMessage.classList.remove('d-none', 'text-info', 'alert-danger', 'alert-warning');
    DOM.errorMessage.classList.add(`alert-${errorType}`);

    if (options.status >= 500) {
      DOM.errorMessage.innerHTML = `
        ${message}
        <button type="button" class="btn-close" aria-label="Fechar" onclick="this.parentElement.classList.add('d-none')"></button>
      `;
    }
  }

  if (options.status < 500) {
    if (errorTimeout) clearTimeout(errorTimeout);
    errorTimeout = setTimeout(() => {
      if (DOM.errorMessage) {
        DOM.errorMessage.classList.add('d-none');
        DOM.errorMessage.classList.remove('alert-danger', 'alert-warning');
      }
      errorTimeout = null;
    }, options.timeout || 5000);
  }
}

/**
 * Exibe uma mensagem de progresso/informação na UI.
 * @param {string} messageKey Chave i18n.
 * @param {string} [fallbackMessage] Mensagem padrão.
 * @param {object} [options] Opções para i18n.
 */
export function showProgress(messageKey, fallbackMessage, options = {}) {
  const isI18nReady = i18nInstance && typeof i18nInstance.exists === 'function' && typeof i18nInstance.t === 'function';
  let message;
  if (isI18nReady) {
    message = i18nInstance.exists(messageKey)
      ? i18nInstance.t(messageKey, options)
      : fallbackMessage || messageKey;
  } else {
    console.warn("i18nInstance não está inicializado. Usando mensagem padrão.");
    message = fallbackMessage || messageKey;
  }

  if (DOM.errorMessage) {
    DOM.errorMessage.textContent = message;
    DOM.errorMessage.classList.remove('d-none', 'text-danger', 'alert-danger', 'alert-warning');
    DOM.errorMessage.classList.add('text-info');
  }
  if (progressTimeout) clearTimeout(progressTimeout);
  progressTimeout = setTimeout(() => {
    if (DOM.errorMessage && DOM.errorMessage.classList.contains('text-info')) {
      DOM.errorMessage.classList.add('d-none');
      DOM.errorMessage.classList.remove('text-info');
    }
    progressTimeout = null;
  }, options.timeout || 5000);
}

/**
 * Limpa a mensagem de progresso/informação.
 */
export function clearProgress() {
  if (progressTimeout) {
    clearTimeout(progressTimeout);
    progressTimeout = null;
  }
  if (DOM.errorMessage && DOM.errorMessage.classList.contains('text-info')) {
    DOM.errorMessage.classList.add('d-none');
    DOM.errorMessage.classList.remove('text-info');
  }
}

/**
 * Controla a exibição do spinner no botão de submit e o estado de desabilitado.
 * @param {boolean} show True para mostrar o spinner, false para esconder.
 */
export function toggleSpinner(show) {
  if (DOM.submitButton) {
    DOM.submitButton.disabled = show;
    if (show) {
      DOM.submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    } else {
      DOM.submitButton.innerHTML = `<i class="fas fa-arrow-right"></i>`;
    }
  }
}

/**
 * Alterna a visibilidade de um elemento adicionando/removendo a classe 'd-none'.
 * @param {HTMLElement | null} element O elemento do DOM.
 * @param {boolean} isVisible True para mostrar, false para esconder.
 */
export function updateElementVisibility(element, isVisible) {
  if (!element) return;
  if (isVisible) {
      element.classList.remove('d-none');
  } else {
      element.classList.add('d-none');
  }
}

/**
 * Reseta a interface para o estado inicial de um novo caso.
 */
export function resetUIForNewCase() {
  if (DOM.entradaUsuario) DOM.entradaUsuario.value = '';

  updateElementVisibility(DOM.downloadPdfBtn, false);

  toggleSpinner(false);
}

/**
 * Escapa caracteres HTML para exibição segura.
 * @param {string | null | undefined} unsafe Texto potencialmente inseguro.
 * @returns {string} Texto seguro para HTML.
 */
export function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "")
      .replace(/'/g, "'");
}