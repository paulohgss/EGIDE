import { DOM } from './dom-elements.js';
import { AppState } from './state.js';
import { i18nInstance } from './i18n.js';

let errorTimeout = null;
let progressTimeout = null;

export function showError(messageKey, fallbackMessage, options = {}) {
    const message = i18nInstance.exists(messageKey)
        ? i18nInstance.t(messageKey, options)
        : fallbackMessage || messageKey || i18nInstance.t('errorMessageDefault', 'Ocorreu um erro.');

    if (DOM.errorMessage) {
        DOM.errorMessage.textContent = message;
        DOM.errorMessage.classList.remove('d-none', 'text-info');
        DOM.errorMessage.classList.add('text-danger');
    }

    if (errorTimeout) clearTimeout(errorTimeout);

    errorTimeout = setTimeout(() => {
        if (DOM.errorMessage) DOM.errorMessage.classList.add('d-none');
        errorTimeout = null;
    }, 5000);
}

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

export function toggleSpinner(show) {
    DOM.submitSpinner?.classList.toggle('d-none', !show);
    if (DOM.submitButton) DOM.submitButton.disabled = show;
    DOM.manualActionButtons?.forEach(btn => btn.disabled = show);
    if (DOM.respondSupervisorBtn) DOM.respondSupervisorBtn.disabled = show;
}

export function updateElementVisibility(element, show) {
    element?.classList.toggle('d-none', !show);
}

export function resetUIForNewCase() {
    if (DOM.entradaUsuario) DOM.entradaUsuario.value = '';
    if (DOM.respostaFinal) DOM.respostaFinal.textContent = '';
    if (DOM.respostaUsuarioInput) DOM.respostaUsuarioInput.value = '';

    updateElementVisibility(DOM.respostaFinal, false);
    updateElementVisibility(DOM.downloadPdfBtn, false);
    updateElementVisibility(DOM.respostaUsuarioBox, false);
    updateElementVisibility(DOM.logsIndividuais, false);
    if (DOM.errorMessage) DOM.errorMessage.classList.add('d-none');

    if (DOM.filterSelect) DOM.filterSelect.value = "ALL";

    toggleSpinner(false);
}

export function showFinalResponse(responseText) {
    if (DOM.respostaFinal) {
        const t = i18nInstance.t.bind(i18nInstance);
        const prefix = t("finalResponsePrefix", "✅ Resposta Final");
        DOM.respostaFinal.innerHTML = `<strong>${prefix}:</strong><pre class="log-text">${escapeHtml(responseText)}</pre>`;
        updateElementVisibility(DOM.respostaFinal, true);
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}