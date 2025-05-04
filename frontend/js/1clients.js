import { getClientSessions } from './api.js';
import { SESSION_ID_STORAGE_KEY } from './state.js';
import { initializeI18n, updateContent } from './i18n.js';
import { DOM } from './dom-elements.js';

// --- Seletores DOM ---
const pageTitle = document.getElementById('page-title');
const table = document.getElementById('sessions-table');
const tableBody = document.getElementById('sessions-table-body');
const loadingIndicator = document.getElementById('sessions-loading');
const errorIndicator = document.getElementById('sessions-error');
const noSessionsMessage = document.getElementById('no-sessions-message');
const messageDiv = document.getElementById('sessions-message');

// --- Funções Auxiliares ---
function showPageError(message) {
  if (messageDiv) {
    messageDiv.textContent = message;
    messageDiv.classList.remove('d-none');
  }
}

function clearPageError() {
  if (messageDiv) {
    messageDiv.textContent = '';
    messageDiv.classList.add('d-none');
  }
}

function toggleTableStatus(status) {
  console.log(`[toggleTableStatus] Setting status to: ${status}`);
  loadingIndicator?.classList.toggle('d-none', status !== 'loading');
  errorIndicator?.classList.toggle('d-none', status !== 'error');
  noSessionsMessage?.classList.toggle('d-none', status !== 'no-data');
  table?.classList.toggle('d-none', status !== 'has-data');
  console.log(`[toggleTableStatus] Loading hidden: ${loadingIndicator?.classList.contains('d-none')}`);
  console.log(`[toggleTableStatus] Table hidden: ${table?.classList.contains('d-none')}`);

  if (status !== 'has-data' && tableBody) {
    tableBody.innerHTML = '';
  }
  if (status !== 'error' && errorIndicator) {
    errorIndicator.textContent = '';
  }
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString('pt-BR');
}

function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

// --- Funções Principais ---
async function fetchAndRenderClientSessions(clientId, clientName) {
  clearPageError();
  toggleTableStatus('loading');

  try {
    console.log("[fetchAndRenderClientSessions] Calling getClientSessions...");
    const sessionData = await getClientSessions(clientId);
    console.log("[fetchAndRenderClientSessions] Received session data:", sessionData);

    const sessions = sessionData?.sessions || [];
    if (!Array.isArray(sessions)) {
      console.error("[fetchAndRenderClientSessions] Erro: API não retornou um array de sessões.", sessions);
      throw new Error("Formato de resposta inválido da API.");
    }

    if (sessions.length === 0) {
      console.log("[fetchAndRenderClientSessions] No sessions found. Setting status to 'no-data'.");
      toggleTableStatus('no-data');
      noSessionsMessage.textContent = 'Nenhuma sessão encontrada para este cliente.';
    } else {
      console.log("[fetchAndRenderClientSessions] Sessions found. Setting status to 'has-data'.");
      toggleTableStatus('has-data');
      if (!tableBody) {
        console.error("[fetchAndRenderClientSessions] Erro Crítico: Elemento #sessions-table-body não encontrado!");
        throw new Error("Elemento da tabela não encontrado.");
      }
      tableBody.innerHTML = '';
      console.log("[fetchAndRenderClientSessions] Rendering session rows...");
      sessions.forEach((session, index) => {
        if (!session) {
          console.warn(`Pulando sessão NULA no índice ${index}`);
          return;
        }

        console.log(`[fetchAndRenderClientSessions] Data for row ${index}:`, JSON.stringify(session, null, 2));

        const row = tableBody.insertRow();
        try {
          const lastUpdate = session.last_updated_at;
          const sessionId = session.session_id;
          const titleDisplay = escapeHtml(sessionId);

          row.innerHTML = `
            <td>${formatTimestamp(lastUpdate)}</td>
            <td>${escapeHtml(sessionId)}</td>
            <td>${titleDisplay}</td>
            <td>
              <button class="btn btn-sm btn-primary load-session-btn" data-session-id="${escapeHtml(sessionId)}">
                Carregar Análise
              </button>
            </td>
          `;
        } catch (renderError) {
          console.error(`[fetchAndRenderClientSessions] Erro ao renderizar HTML para sessão ${session?.session_id || 'desconhecida'}:`, renderError);
          const errorRow = tableBody.insertRow();
          const cell = errorRow.insertCell();
          cell.colSpan = 4;
          cell.textContent = `Erro ao renderizar esta sessão`;
          cell.style.color = 'red';
        }
      });
      console.log("[fetchAndRenderClientSessions] Finished rendering rows.");
    }
  } catch (error) {
    console.error("[fetchAndRenderClientSessions] Erro ao buscar/renderizar sessões:", error);
    if (errorIndicator) {
      errorIndicator.textContent = error.message || "Erro ao carregar as sessões.";
    }
    toggleTableStatus('error');
  }
}

function handleLoadSession(sessionId) {
  if (!sessionId) {
    console.error("handleLoadSession chamado sem sessionId.");
    showPageError("Erro ao obter ID da sessão.");
    return;
  }
  console.log(`Tentando carregar sessão ID: ${sessionId}`);
  console.log(`Valor de sessionId ANTES do localStorage: ${sessionId}`);
  localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  sessionStorage.setItem('cameFrom', 'client-sessions');
  window.location.href = 'chat.html';
}

// --- Inicialização da Página ---
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('clientId');
  const clientName = urlParams.get('clientName') || 'Cliente';

  if (pageTitle && clientId) {
    pageTitle.textContent = `Histórico de Análises - ${escapeHtml(clientName)}`;
  } else if (!clientId) {
    console.error("clientId não encontrado nos parâmetros da URL.");
    showPageError("Erro: ID do cliente não especificado na URL.");
    toggleTableStatus('error');
    if (errorIndicator) errorIndicator.textContent = "ID do cliente não encontrado na URL.";
    return;
  }

  // Inicializar i18n antes de chamar fetchAndRenderClientSessions
  try {
    await initializeI18n();
    // Atualizar conteúdo após inicialização do i18n
    updateContent(DOM);

    fetchAndRenderClientSessions(clientId, clientName);

    if (tableBody) {
      tableBody.addEventListener('click', (event) => {
        const button = event.target.closest('.load-session-btn');
        if (button) {
          const sessionIdFromData = button.dataset.sessionId;
          console.log("Botão 'Carregar Análise' clicado. ID da Sessão:", sessionIdFromData);
          handleLoadSession(sessionIdFromData);
        }
      });
      console.log("Listener delegado adicionado ao tbody para botões 'Carregar Análise'.");
    }

    console.log(`Página de histórico carregada para cliente: ${clientName} (ID: ${clientId})`);
  } catch (err) {
    console.error("Falha ao inicializar i18n:", err);
    showPageError("Erro ao carregar configurações de idioma.");
    toggleTableStatus('error');
    if (errorIndicator) errorIndicator.textContent = "Erro ao carregar configurações de idioma.";
  }
});