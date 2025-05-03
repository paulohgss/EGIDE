// frontend/js/clients.js

// Importa URLs e funções da API (precisaremos criar getClients e addClient em api.js)
import { API_BASE_URL } from './config.js'; // Usaremos para construir URLs aqui
import { SESSION_ID_STORAGE_KEY } from './state.js'; // Para logout
import { getClients, addClient } from './api.js';

// --- Seletores DOM ---
const clientForm = document.getElementById('add-client-form');
const clientNameInput = document.getElementById('client-name');
const clientCpfInput = document.getElementById('client-cpf');
const clientDobInput = document.getElementById('client-dob');
const messageDivClient = document.getElementById('client-message');
const addClientButton = clientForm?.querySelector('button[type="submit"]');
const addClientSpinner = document.getElementById('add-client-spinner');
const tableBodyClients = document.getElementById('clients-table-body');
const loadingIndicatorClients = document.getElementById('clients-loading');
const errorIndicatorClients = document.getElementById('clients-error');
const noClientsMessage = document.getElementById('no-clients-message');
const logoutLinkClients = document.getElementById('logout-link-clients');

// --- URLs da API (Construídas a partir da base) ---
const API_CLIENTS_URL = `${API_BASE_URL}/clients`;

// --- Funções Auxiliares ---

/** Pega o token do localStorage */
function getToken() {
    return localStorage.getItem('token');
}



/** Exibe mensagem de erro/sucesso */
function showClientMessage(message, isError = true) {
    if (messageDivClient) {
        messageDivClient.textContent = message;
        messageDivClient.classList.remove('d-none', 'alert-danger', 'alert-success');
        messageDivClient.classList.add(isError ? 'alert-danger' : 'alert-success');
    }
}

/** Limpa mensagem */
function clearClientMessage() {
    if (messageDivClient) {
        messageDivClient.textContent = '';
        messageDivClient.classList.add('d-none');
        messageDivClient.classList.remove('alert-danger', 'alert-success');
    }
}

/** Alterna loading do botão de adicionar cliente */
function toggleClientAddLoading(isLoading) {
    if (addClientButton) addClientButton.disabled = isLoading;
    addClientSpinner?.classList.toggle('d-none', isLoading);
}

/** Alterna loading da tabela de clientes */
function toggleClientTableLoading(isLoading) {
    loadingIndicatorClients?.classList.toggle('d-none', !isLoading);
    if (isLoading) {
        errorIndicatorClients?.classList.add('d-none');
        noClientsMessage?.classList.add('d-none');
        if (tableBodyClients) tableBodyClients.innerHTML = '';
    }
}

/** Escapa HTML */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}




// --- Funções Principais da Página ---

/** Busca e renderiza a lista de clientes na tabela */
async function fetchAndRenderClients() {
    toggleClientTableLoading(true);
    errorIndicatorClients?.classList.add('d-none');
    noClientsMessage?.classList.add('d-none');

    try {
        const clients = await getClients();

        if (!tableBodyClients) return;
        tableBodyClients.innerHTML = '';

        if (clients.length === 0) {
            noClientsMessage?.classList.remove('d-none');
        } else {
            clients.forEach(client => {
                const row = tableBodyClients.insertRow();
                // Formata CPF e Data (simples)
                const formattedCpf = client.cpf ?
                    client.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'N/A';
                const formattedDob = client.dob ?
                    client.dob.split('-').reverse().join('/') : 'N/A'; // AAAA-MM-DD -> DD/MM/AAAA

                row.innerHTML = `
                    <td>${escapeHtml(client.name)}</td>
                    <td>${escapeHtml(formattedCpf)}</td>
                    <td>${escapeHtml(formattedDob)}</td>
                    <td>
                        <button class="btn btn-sm btn-success start-analysis-btn" data-client-id="${escapeHtml(client.client_id)}" data-client-name="${escapeHtml(client.name)}">
                            Iniciar Análise
                        </button>
                        </td>
                `;
            });
            // Adiciona listeners aos botões "Iniciar Análise" DEPOIS de criar a tabela
            addStartAnalysisListeners();
        }
    } catch (error) {
        console.error("Erro ao buscar/renderizar clientes:", error);
        if (errorIndicatorClients) {
            errorIndicatorClients.textContent = `Erro ao carregar clientes: ${error.message}`;
            errorIndicatorClients.classList.remove('d-none');
        }
        if (tableBodyClients) tableBodyClients.innerHTML = '';
        noClientsMessage?.classList.remove('d-none');
    } finally {
        toggleClientTableLoading(false);
    }
}

/** Lida com o envio do formulário de adicionar cliente */
async function handleAddClient(event) {
    event.preventDefault();
    clearClientMessage();

    const name = clientNameInput?.value;
    const cpf = clientCpfInput?.value;
    const dob = clientDobInput?.value;

    if (!name) {
        showClientMessage("Nome do cliente é obrigatório.");
        return;
    }
    // Validações mais robustas de CPF/Data podem ser adicionadas aqui no frontend também

    toggleClientAddLoading(true);

    try {
        const result = await addClient(name, cpf, dob);
        showClientMessage(result.message || "Cliente adicionado com sucesso!", false);
        if (clientForm) clientForm.reset();
        fetchAndRenderClients(); // Atualiza a lista

    } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
        showClientMessage(error.message || "Não foi possível adicionar o cliente.");
    } finally {
        toggleClientAddLoading(false);
    }
}

/** Adiciona listeners aos botões "Iniciar Análise" */
function addStartAnalysisListeners() {
    const buttons = document.querySelectorAll('.start-analysis-btn');
    buttons.forEach(button => {
        // Remove listener antigo para evitar duplicação se re-renderizar
        button.replaceWith(button.cloneNode(true));
    });
    // Readiciona listener aos novos botões clonados
     document.querySelectorAll('.start-analysis-btn').forEach(button => {
         button.addEventListener('click', handleStartAnalysis);
     });

}

/** Lida com o clique no botão "Iniciar Análise" */
function handleStartAnalysis(event) {
    const button = event.currentTarget;
    const clientId = button.dataset.clientId;
    const clientName = button.dataset.clientName;

    if (!clientId || !clientName) {
        console.error("ID ou Nome do cliente não encontrado no botão.");
        alert("Erro ao obter dados do cliente.");
        return;
    }

    console.log(`Iniciando análise para Cliente ID: ${clientId}, Nome: ${clientName}`);

    // 1. Guardar a informação do cliente para a próxima página (index.html)
    // Usaremos sessionStorage pois só precisamos disso para a próxima carga da página
    sessionStorage.setItem('selectedClientId', clientId);
    sessionStorage.setItem('selectedClientName', clientName);
    // Poderíamos guardar perguntas preliminares aqui também, se tivéssemos

    // 2. Redirecionar para a página do chat (index.html)
    window.location.href = '/'; // Ou index.html

}

/** Lida com o logout a partir desta página */
function handleClientPageLogout() {
    console.log("Executando logout da página de clientes...");
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem(SESSION_ID_STORAGE_KEY); // Importado de state.js
    window.location.href = 'login.html';
}


// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando página de gerenciamento de clientes...");
    const token = getToken();
    if (!token) {
        console.log("Nenhum token encontrado, redirecionando para login.");
        window.location.href = 'login.html';
        return;
    }

    console.log("Usuário autenticado. Buscando clientes...");
    fetchAndRenderClients();

    if (clientForm) {
        clientForm.addEventListener('submit', handleAddClient);
        console.log("Listener do formulário de adicionar cliente configurado.");
    }

    if (logoutLinkClients) {
        logoutLinkClients.addEventListener('click', (e) => {
            e.preventDefault();
            handleClientPageLogout();
        });
        console.log("Listener de logout da página configurado.");
    }
});