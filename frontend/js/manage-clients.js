// frontend/js/manage-clients.js

import { getClients, addClient } from './api.js';
import { initializeI18n, updateContent, i18nInstance } from './i18n.js';
import { DOM, initializeDOM } from './dom-elements.js';
import { showError, updateElementVisibility } from './ui.js';

// Seletores DOM
const addClientForm = document.getElementById('add-client-form');
const clientNameInput = document.getElementById('client-name');
const clientCpfInput = document.getElementById('client-cpf');
const clientDobInput = document.getElementById('client-dob');
const messageDiv = document.getElementById('client-message');
const addButton = addClientForm?.querySelector('button[type="submit"]');
const addButtonText = document.getElementById('add-client-btn-text');
const addSpinner = document.getElementById('add-client-spinner');
const tableBody = document.getElementById('clients-table-body');
const loadingIndicator = document.getElementById('clients-loading');
const errorIndicator = document.getElementById('clients-error');
const noClientsMessage = document.getElementById('no-clients-message');
const logoutLink = document.getElementById('logout-link-clients');
const backToMainLink = document.getElementById('back-to-main-clients');

// Função para escapar HTML
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string' || unsafe == null) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Funções Auxiliares
function showMessage(message, isError = true) {
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.classList.remove('d-none', 'alert-danger', 'alert-success');
        messageDiv.classList.add(isError ? 'alert-danger' : 'alert-success');
    }
}

function clearMessage() {
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.classList.add('d-none');
        messageDiv.classList.remove('alert-danger', 'alert-success');
    }
}

function toggleAddLoading(isLoading) {
    if (addButton) addButton.disabled = isLoading;
    updateElementVisibility(addSpinner, isLoading);
    updateElementVisibility(addButtonText, !isLoading);
}

function toggleTableStatus(status) {
    console.log(`[toggleTableStatus] Setting status to: ${status}`);
    console.log(`[toggleTableStatus] DOM elements:`, {
        loadingIndicator: !!loadingIndicator,
        errorIndicator: !!errorIndicator,
        noClientsMessage: !!noClientsMessage,
        tableBody: !!tableBody
    });
    updateElementVisibility(loadingIndicator, status === 'loading');
    updateElementVisibility(errorIndicator, status === 'error');
    updateElementVisibility(noClientsMessage, status === 'no-data');
    updateElementVisibility(tableBody?.parentElement, status === 'has-data');
    console.log(`[toggleTableStatus] Loading hidden: ${loadingIndicator?.classList.contains('d-none')}`);
    console.log(`[toggleTableStatus] Table hidden: ${tableBody?.parentElement?.classList.contains('d-none')}`);

    if (status !== 'has-data' && tableBody) {
        tableBody.innerHTML = '';
    }
    if (status !== 'error' && errorIndicator) {
        errorIndicator.textContent = '';
    }
}

function formatCpf(cpf) {
    if (!cpf) return 'N/A';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('pt-BR');
}

// Funções Principais
async function fetchAndRenderClients() {
    toggleTableStatus('loading');
    clearMessage();

    try {
        const clients = await getClients();
        tableBody.innerHTML = '';

        if (clients.length === 0) {
            toggleTableStatus('no-data');
            const isI18nReady = i18nInstance && typeof i18nInstance.t === 'function';
            const t = isI18nReady ? i18nInstance.t.bind(i18nInstance) : (key, fallback) => fallback;
            if (noClientsMessage) {
                noClientsMessage.textContent = t('noClients', 'Nenhum cliente cadastrado ainda.');
            }
        } else {
            toggleTableStatus('has-data');
            clients.forEach(client => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${escapeHtml(client.name)}</td>
                    <td>${escapeHtml(formatCpf(client.cpf))}</td>
                    <td>${escapeHtml(formatDate(client.dob))}</td>
                    <td>
                        <a href="client-sessions.html?clientId=${encodeURIComponent(client.client_id)}&clientName=${encodeURIComponent(client.name)}" class="btn btn-sm btn-primary">Ver Análises</a>
                    </td>
                `;
            });
        }
    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        const isI18nReady = i18nInstance && typeof i18nInstance.t === 'function';
        const t = isI18nReady ? i18nInstance.t.bind(i18nInstance) : (key, fallback) => fallback;
        errorIndicator.textContent = error.message || t('errorFetchingClients', 'Erro ao carregar clientes.');
        toggleTableStatus('error');
    }
}

async function handleAddClient(event) {
    event.preventDefault();
    clearMessage();

    const name = clientNameInput?.value.trim();
    const cpf = clientCpfInput?.value.replace(/\D/g, '');
    const dob = clientDobInput?.value;

    if (!name) {
        const isI18nReady = i18nInstance && typeof i18nInstance.t === 'function';
        const t = isI18nReady ? i18nInstance.t.bind(i18nInstance) : (key, fallback) => fallback;
        showMessage(t('errorFieldsRequired', 'Nome é obrigatório.'));
        return;
    }

    toggleAddLoading(true);

    try {
        await addClient(name, cpf || null, dob || null);
        const isI18nReady = i18nInstance && typeof i18nInstance.t === 'function';
        const t = isI18nReady ? i18nInstance.t.bind(i18nInstance) : (key, fallback) => fallback;
        showMessage(t('clientAdded', 'Cliente adicionado com sucesso!'), false);
        addClientForm.reset();
        fetchAndRenderClients();
    } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
        showMessage(error.message || 'Erro ao adicionar cliente.');
    } finally {
        toggleAddLoading(false);
    }
}

function handleLogout() {
    console.log("Executando logout...");
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    window.location.href = 'login.html';
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        initializeDOM();
        if (!tableBody || !addClientForm) {
            throw new Error('Falha ao inicializar elementos do DOM.');
        }
        await initializeI18n();
        updateContent(DOM); // Corrigido: Passar DOM em vez de {}
        fetchAndRenderClients();

        if (addClientForm) {
            addClientForm.addEventListener('submit', handleAddClient);
        }

        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }

        if (backToMainLink) {
            backToMainLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/';
            });
        }
    } catch (err) {
        console.error("Falha ao inicializar página:", err);
        const isI18nReady = i18nInstance && typeof i18nInstance.t === 'function';
        const t = isI18nReady ? i18nInstance.t.bind(i18nInstance) : (key, fallback) => fallback;
        showError('errorPageInit', t('errorPageInit', 'Erro ao carregar a página: ') + err.message);
        toggleTableStatus('error');
    }
});