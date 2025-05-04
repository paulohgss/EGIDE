// index-page.js

import { DOM, initializeDOM } from './dom-elements.js';
import { initializeTheme, toggleTheme } from './theme.js';
import { initializeI18n, updateContent } from './i18n.js';
import { getClients, getAssistants } from './api.js';
import { showError } from './ui.js'; // Adicionado


function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "")
        .replace(/'/g, "'");
}

function handleLogout() {
    console.log("Executando logout...");
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    window.location.href = 'login.html';
}

async function fetchAndRenderClients() {
    if (!DOM.recentClientsTableBody) {
        console.error("Elemento #recent-clients-table-body não encontrado.");
        return;
    }
    DOM.clientsLoading?.classList.remove('d-none');
    DOM.clientsError?.classList.add('d-none');
    DOM.noClientsMessage?.classList.add('d-none');

    try {
        const clients = await getClients();
        DOM.recentClientsTableBody.innerHTML = '';

        if (clients.length === 0) {
            DOM.noClientsMessage?.classList.remove('d-none');
        } else {
            clients.forEach(client => {
                const row = DOM.recentClientsTableBody.insertRow();
                const formattedCpf = client.cpf ? client.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'N/A';
                row.innerHTML = `
                    <td>${escapeHtml(client.name)}</td>
                    <td>${escapeHtml(formattedCpf)}</td>
                    <td>
                        <a href="client-sessions.html?clientId=${encodeURIComponent(client.client_id)}&clientName=${encodeURIComponent(client.name)}" class="btn btn-sm btn-primary">Ver Análises</a>
                    </td>
                `;
            });
        }
    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        DOM.clientsError.textContent = `Erro ao carregar clientes: ${error.message}`;
        DOM.clientsError?.classList.remove('d-none');
    } finally {
        DOM.clientsLoading?.classList.add('d-none');
    }
}

async function fetchAndRenderAssistants() {
    if (!DOM.assistantsCount) {
        console.error("Elemento #assistants-count não encontrado.");
        return;
    }
    try {
        const assistants = await getAssistants();
        DOM.assistantsCount.textContent = `Você tem ${assistants.length} assistente(s) cadastrado(s).`;
        DOM.assistantsSummary?.classList.remove('d-none');
    } catch (error) {
        console.error("Erro ao buscar assistentes:", error);
        DOM.assistantsSummary?.classList.add('d-none');
    }
}

function setupEventListeners() {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (event) => {
            event.preventDefault();
            console.log("Executando logout...");
            localStorage.removeItem('token');
            localStorage.removeItem('user_id');
            localStorage.removeItem(SESSION_ID_STORAGE_KEY);
            window.location.href = 'login.html';
        });
    } else {
        console.warn("Elemento #logout-link não encontrado.");
    }

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    } else {
        console.warn("Elemento #theme-toggle não encontrado.");
    }
}

// Remover: import jwt_decode from "jwt-decode";
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inicializando painel principal...");

    const token = localStorage.getItem('token');
    if (!token) {
        console.log("Nenhum token encontrado, redirecionando para login.");
        window.location.href = 'login.html';
        return;
    }

    try {
        initializeDOM();
        if (!DOM.recentClientsTableBody || !DOM.userGreeting) {
            throw new Error('Falha ao inicializar elementos do DOM.');
        }
        await initializeI18n();
        updateContent(DOM);
        initializeTheme();
        setupEventListeners();

        const userGreetingElement = DOM.userGreeting;
        const userId = localStorage.getItem('user_id');
        if (userId && userGreetingElement) {
            userGreetingElement.textContent = `Olá! (ID: ${userId})`;
            userGreetingElement.classList.remove('d-none');
        }

        const decodedToken = decodeJwtPayload(token);
        if (!decodedToken) {
            throw new Error('Falha ao decodificar o token JWT.');
        }
        console.log('Token decodificado:', decodedToken);
        const userRole = decodedToken.role;

        const manageAssistantsLink = document.getElementById('manage-assistants-link');
        if (manageAssistantsLink && userRole !== 'master') {
            manageAssistantsLink.style.display = 'none';
        }

        await Promise.all([fetchAndRenderClients(), fetchAndRenderAssistants()]);
    } catch (error) {
        console.error("Erro ao inicializar painel principal:", error);
        try {
            showError('errorAppInit', 'Erro ao carregar o painel principal: ' + error.message);
        } catch (showErrorErr) {
            console.error("Falha ao exibir erro:", showErrorErr);
            const errorDiv = DOM.clientsError || document.getElementById('clients-error');
            if (errorDiv) {
                errorDiv.textContent = 'Erro ao carregar o painel principal. Por favor, recarregue a página.';
                errorDiv.classList.remove('d-none');
            } else {
                alert('Erro ao carregar o painel principal: ' + error.message);
            }
        }
    }
});

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