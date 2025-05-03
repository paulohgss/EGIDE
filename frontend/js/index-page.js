import { SESSION_ID_STORAGE_KEY } from './state.js';
import { getClients, getAssistants } from './api.js';
import { DOM } from './dom-elements.js';
import { initializeTheme, toggleTheme } from './theme.js';

function decodeJwtPayload(token) {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Erro ao decodificar payload do JWT:", e);
        return null;
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;") // Linha 26 corrigida
        .replace(/'/g, "&#039;");
}

function showError(message) {
    const notificationsList = document.getElementById('notifications-list');
    if (notificationsList) {
        notificationsList.textContent = message;
        notificationsList.classList.remove('alert-info');
        notificationsList.classList.add('alert-danger');
    }
}

async function renderRecentClients() {
    const tableBody = document.getElementById('recent-clients-table-body');
    const loading = document.getElementById('clients-loading');
    const error = document.getElementById('clients-error');
    const noClients = document.getElementById('no-clients-message');

    if (!tableBody) return;

    loading.classList.remove('d-none');
    error.classList.add('d-none');
    noClients.classList.add('d-none');

    try {
        const clients = await getClients();
        tableBody.innerHTML = '';

        if (clients.length === 0) {
            noClients.classList.remove('d-none');
        } else {
            clients.slice(0, 5).forEach(client => {
                const row = tableBody.insertRow();
                const formattedCpf = client.cpf ?
                    client.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'N/A';
                row.innerHTML = `
                    <td>${escapeHtml(client.name)}</td>
                    <td>${escapeHtml(formattedCpf)}</td>
                    <td>
                        <button class="btn btn-sm btn-success start-analysis-btn me-2" 
                                data-client-id="${escapeHtml(client.client_id)}" 
                                data-client-name="${escapeHtml(client.name)}">
                            Iniciar Análise
                        </button>
                        <a href="client-sessions.html?clientId=${escapeHtml(client.client_id)}&clientName=${encodeURIComponent(client.name)}" 
                           class="btn btn-sm btn-info">
                            Ver Histórico
                        </a>
                    </td>
                `;
            });
            tableBody.querySelectorAll('.start-analysis-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const clientId = button.dataset.clientId;
                    const clientName = button.dataset.clientName;
                    sessionStorage.setItem('selectedClientId', clientId);
                    sessionStorage.setItem('selectedClientName', clientName);
                    sessionStorage.setItem('cameFrom', 'index');
                    window.location.href = 'chat.html';
                });
            });
        }
    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        error.classList.remove('d-none');
        noClients.classList.add('d-none');
    } finally {
        loading.classList.add('d-none');
    }
}

async function renderAssistantsSummary() {
    const summarySection = document.getElementById('assistants-summary');
    const countElement = document.getElementById('assistants-count');
    if (!summarySection || !countElement) return;

    try {
        const assistants = await getAssistants();
        countElement.innerHTML = `Você tem ${assistants.length} assistente(s) cadastrado(s). 
            <a href="assistants.html" class="text-primary">Ver todos</a>.`;
        summarySection.classList.remove('d-none');
    } catch (error) {
        console.error("Erro ao carregar assistentes:", error);
        summarySection.classList.add('d-none');
    }
}

function handleLogout() {
    console.log("Executando logout do painel principal...");
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem(SESSION_ID_STORAGE_KEY);
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inicializando painel principal...");

    // Inicializa os elementos DOM antes de qualquer manipulação
    DOM.initialize();
    console.log("Elementos DOM inicializados:", {
        bodyExists: !!DOM.body,
        userGreetingExists: !!document.getElementById('user-greeting')
    });

    // Agora que o DOM está inicializado, podemos chamar initializeTheme
    initializeTheme();

    const token = localStorage.getItem('token');
    if (!token) {
        console.log("Nenhum token encontrado, redirecionando para login.");
        window.location.href = 'login.html';
        return;
    }

    const userGreetingElement = document.getElementById('user-greeting');
    const payload = decodeJwtPayload(token);
    const username = payload?.username;
    const userRole = payload?.role;

    if (userGreetingElement) {
        userGreetingElement.textContent = username ? 
            `Olá, ${escapeHtml(username)}!` : 
            `Olá! (ID: ${localStorage.getItem('user_id') || 'Usuário'})`;
        userGreetingElement.classList.remove('d-none');
    }

    const manageAssistantsCard = document.getElementById('manage-assistants-card');
    if (manageAssistantsCard && userRole !== 'master') {
        console.log("Usuário não é master, escondendo opção 'Gerenciar Assistentes'.");
        manageAssistantsCard.classList.add('d-none');
    }

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    await renderRecentClients();
    if (userRole === 'master') {
        await renderAssistantsSummary();
    }

    console.log("Painel principal pronto.");
});