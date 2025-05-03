// frontend/js/manage-users.js

// Importa funções da API que criamos
import { getAssistants, addAssistant } from './api.js';
// Importa SESSION_ID_STORAGE_KEY se precisarmos limpar no logout
import { SESSION_ID_STORAGE_KEY } from './state.js';

// --- Seletores DOM Específicos desta Página ---
const assistantForm = document.getElementById('add-assistant-form');
const assistantUsernameInput = document.getElementById('assistant-username');
const assistantPasswordInput = document.getElementById('assistant-password');
const messageDiv = document.getElementById('assistant-message');
const addButton = assistantForm?.querySelector('button[type="submit"]');
const addButtonText = document.getElementById('add-assistant-btn-text');
const addSpinner = document.getElementById('add-spinner');
const tableBody = document.getElementById('assistants-table-body');
const loadingIndicator = document.getElementById('assistants-loading');
const errorIndicator = document.getElementById('assistants-error');
const noAssistantsMessage = document.getElementById('no-assistants-message');
const logoutLink = document.getElementById('logout-link-assistants');

// --- Funções Auxiliares ---

/**
 * Exibe uma mensagem (erro ou sucesso) na área designada.
 * @param {string} message A mensagem a ser exibida.
 * @param {boolean} [isError=true] Define se a mensagem é de erro (vermelho) ou sucesso (verde).
 */
function showMessage(message, isError = true) {
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.classList.remove('d-none', 'alert-danger', 'alert-success');
        messageDiv.classList.add(isError ? 'alert-danger' : 'alert-success');
    }
}

/** Limpa a mensagem exibida. */
function clearMessage() {
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.classList.add('d-none');
        messageDiv.classList.remove('alert-danger', 'alert-success');
    }
}

/** Alterna o estado de carregamento do formulário/botão de adicionar. */
function toggleAddLoading(isLoading) {
    if (addButton) addButton.disabled = isLoading;
    addSpinner?.classList.toggle('d-none', !isLoading);
    addButtonText?.classList.toggle('d-none', isLoading);
}

/** Alterna o estado de carregamento da tabela. */
function toggleTableLoading(isLoading) {
    loadingIndicator?.classList.toggle('d-none', !isLoading);
    // Esconde erro e msg "sem assistentes" durante carregamento
    if (isLoading) {
        errorIndicator?.classList.add('d-none');
        noAssistantsMessage?.classList.add('d-none');
        if (tableBody) tableBody.innerHTML = ''; // Limpa tabela enquanto carrega
    }
}

// --- Funções Principais ---

/** Busca e renderiza a lista de assistentes. */
async function fetchAndRenderAssistants() {
    toggleTableLoading(true);
    errorIndicator?.classList.add('d-none'); // Esconde erro antigo
    noAssistantsMessage?.classList.add('d-none'); // Esconde msg antiga

    try {
        const assistants = await getAssistants(); // Chama a função da api.js

        if (!tableBody) return;
        tableBody.innerHTML = ''; // Limpa a tabela antes de preencher

        if (assistants.length === 0) {
            noAssistantsMessage?.classList.remove('d-none'); // Mostra msg se vazio
        } else {
            // Preenche a tabela
            assistants.forEach(assistant => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${escapeHtml(assistant.username)}</td>
                    <td>${escapeHtml(assistant.user_id)}</td>
                    <td>${escapeHtml(assistant.master_user_id)}</td>
                    `;
            });
        }
    } catch (error) {
        console.error("Erro ao buscar/renderizar assistentes:", error);
        if (errorIndicator) {
            errorIndicator.textContent = `Erro ao carregar assistentes: ${error.message}`;
            errorIndicator.classList.remove('d-none');
        }
    } finally {
        toggleTableLoading(false);
    }
}

/** Lida com a submissão do formulário de adicionar assistente. */
async function handleAddAssistant(event) {
    event.preventDefault();
    clearMessage();

    const username = assistantUsernameInput?.value;
    const password = assistantPasswordInput?.value;

    if (!username || !password) {
        showMessage("Nome de usuário e senha são obrigatórios.");
        return;
    }
    if (password.length < 6) {
        showMessage("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    toggleAddLoading(true);

    try {
        const result = await addAssistant(username, password); // Chama a função da api.js
        showMessage(result.message || "Assistente adicionado com sucesso!", false); // Mostra msg de sucesso (verde)
        // Limpa o formulário
        if (assistantForm) assistantForm.reset();
        // Atualiza a lista de assistentes
        fetchAndRenderAssistants();

    } catch (error) {
        console.error("Erro ao adicionar assistente:", error);
        showMessage(error.message || "Não foi possível adicionar o assistente."); // Mostra msg de erro (vermelho)
    } finally {
        toggleAddLoading(false);
    }
}

/** Lida com o logout a partir desta página. */
function handleAssistantPageLogout() {
    console.log("Executando logout da página de assistentes...");
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem(SESSION_ID_STORAGE_KEY); // Importado de state.js
    window.location.href = 'login.html';
}

/** Escapa HTML simples (segurança básica). */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// --- Inicialização e Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Proteção básica: redireciona se não houver token
    const token = localStorage.getItem('token');
    if (!token) {
        console.log("Nenhum token encontrado, redirecionando para login.");
        window.location.href = 'login.html';
        return; // Impede o resto de rodar
    }

    // TODO: Adicionar verificação de role 'master' aqui.
    // Isso exigiria decodificar o token (com biblioteca jwt-decode) ou
    // fazer uma chamada a um endpoint /api/me no backend.
    // Por enquanto, assume que só masters chegarão aqui pelo link no index.html.
    console.log("Página de gerenciamento de usuários carregada.");

    // Busca e renderiza a lista inicial de assistentes
    fetchAndRenderAssistants();

    // Adiciona listener ao formulário
    if (assistantForm) {
        assistantForm.addEventListener('submit', handleAddAssistant);
    }

    // Adiciona listener ao botão de logout desta página
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleAssistantPageLogout();
        });
    }
});