// frontend/js/api.js (Modificado)

// Importa URLs do config.js
import {
  API_CALL_BOT_URL,
  API_SESSION_HISTORY_URL_BASE,
  API_ASSISTANTS_URL, // <<< Nova URL importada
  API_CLIENTS_URL,
} from './config.js';
import { AppState } from './state.js';
import { showError, showProgress, clearProgress } from './ui.js';
import { i18nInstance } from './i18n.js';

// Função delay (mantém)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
* Pega o token JWT do localStorage.
* @returns {string|null} O token ou null se não existir.
*/
function getAuthToken() {
  return localStorage.getItem('token');
}

/**
* Cria o cabeçalho de autorização Bearer.
* @returns {HeadersInit} Objeto de cabeçalhos com Authorization se o token existir.
*/
function createAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
      headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}


// Função callBotAPI (Ajustada para usar config e helpers)
/// Em frontend/js/api.js

// Assinatura da função modificada para incluir client_id
export async function callBotAPI(role, userMessage, session_id = null, user_id = null, client_id = null, retries = 3) { // client_id adicionado

  const token = getAuthToken(); // Pega o token
  const effectiveUserId = localStorage.getItem('user_id'); // Pega user_id local (para log)

  console.log(`Chamando backend para ${role} (Session: ${session_id || '(Nova)'}, User: ${effectiveUserId}, Client: ${client_id || '(Nenhum)'})...`); // Log melhorado
  showProgress('infoProcessing', 'Processando requisição para {{role}}...', { role });

  let success = false;

  for (let attempt = 1; attempt <= retries; attempt++) {
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

          const headers = createAuthHeaders();

          // <<< MODIFICAÇÃO: Inclui client_id no corpo se ele for fornecido >>>
          const body = { role, message: userMessage };
          if (session_id) body.session_id = session_id;
          // Só envia client_id se ele for passado para a função (na primeira chamada de nova sessão)
          if (client_id) body.client_id = client_id;
          // Não precisamos mais enviar user_id no corpo, o backend pega do token se logado

          console.log("Enviando corpo para /api/call-bot:", body);

          const response = await fetch(API_CALL_BOT_URL, {
              method: 'POST',
              headers,
              body: JSON.stringify(body), // Envia o corpo com client_id (se houver)
              signal: controller.signal
          });

          clearTimeout(timeoutId);
          const data = await response.json().catch(err => { // Tratamento de erro no JSON
              console.error("Erro ao fazer parse do JSON da resposta de /api/call-bot:", err);
              return response.text().then(text => { throw new Error(`Resposta inválida do servidor: ${text.substring(0, 100)}...`) });
          });


          if (!response.ok) {
              throw new Error(data.error || `Erro ${response.status} ao chamar API do bot.`);
          }

          // Processamento da resposta de sucesso
          if (data.choices && data.choices.length > 0 && data.choices[0].message) {
              success = true;

              // Atualiza AppState e localStorage se backend gerou novo ID
              if (data.generated_session_id && AppState.currentSessionId !== data.generated_session_id) {
                   console.log(`Atualizando session ID no estado e localStorage para: ${data.generated_session_id}`);
                   AppState.currentSessionId = data.generated_session_id;
                   localStorage.setItem(SESSION_ID_STORAGE_KEY, data.generated_session_id);
              } else if (session_id && !AppState.currentSessionId) {
                   // Garante que se enviamos um ID, ele esteja no estado
                   AppState.currentSessionId = session_id;
              }

              return data.choices[0].message.content.trim();
          } else {
              console.error("Resposta do backend OK para /api/call-bot, mas formato inesperado:", data);
              throw new Error('Resposta inesperada ou vazia do backend ao chamar o bot.');
          }

      } catch (err) {
           console.error(`Tentativa ${attempt} falhou para ${role} (Session: ${session_id}, Client: ${client_id}):`, err);
           success = false;
           if (attempt === retries) {
               if (err.name === 'AbortError') {
                   showError('timeoutError', 'A requisição para {{role}} demorou muito.', { role });
               } else {
                   showError('apiError', `Erro ao chamar ${role}: ${err.message}`, { status: err.message });
               }
               err.handled = true;
               throw err;
           }
           await delay(1000 * attempt);
      } finally {
         if (attempt === retries || success) {
             clearProgress();
         }
      }
  }
  // Se chegou aqui, todas as tentativas falharam
  throw new Error(`Falha ao chamar API para ${role} após ${retries} tentativas.`);
} // Fim de callBotAPI



// Função getSessionHistory (Ajustada para usar config e helpers)
export async function getSessionHistory(session_id) {
  if (!session_id) {
      console.warn("getSessionHistory chamado sem session_id");
      return [];
  }
  console.log(`Buscando histórico para session_id: ${session_id}`);
  const historyUrl = `${API_SESSION_HISTORY_URL_BASE}/${session_id}`; // <<< Usa URL base do config >>>
  const headers = createAuthHeaders(); // <<< Usa helper >>>

  try {
      const response = await fetch(historyUrl, { method: 'GET', headers });

      if (response.status === 404) {
          console.log(`Histórico não encontrado (404) para session_id: ${session_id}`);
          return { history: [] }; // Retorna objeto padrão para consistência
      }
      const data = await response.json(); // Tenta ler JSON mesmo em erro
      if (!response.ok) {
          throw new Error(data.error || `Erro ${response.status}`);
      }
      return data || { history: [] }; // Retorna { history: [...] } ou objeto padrão

  } catch (err) {
      console.error(`Erro ao recuperar histórico (session: ${session_id}):`, err);
      showError('errorFetchingHistory', `Falha ao carregar histórico: ${err.message}`);
      throw err; // Relança para loadSessionData tratar
  }
}

// <<< NOVA FUNÇÃO para buscar assistentes >>>
/**
* Busca a lista de assistentes associados ao Master logado.
* @returns {Promise<Array<Object>>} Uma promessa que resolve para a lista de assistentes.
*/
export async function getAssistants() {
  console.log("Buscando lista de assistentes...");
  const headers = createAuthHeaders();
  if (!headers['Authorization']) {
      throw new Error("Token de autenticação não encontrado."); // Não deve acontecer se a página for protegida
  }

  try {
      const response = await fetch(API_ASSISTANTS_URL, { // <<< Usa URL do config >>>
          method: 'GET',
          headers: headers
      });
      const data = await response.json();
      if (!response.ok) {
          throw new Error(data.error || `Erro ${response.status}`);
      }
      console.log("Lista de assistentes recebida:", data.assistants);
      return data.assistants || [];
  } catch (err) {
      console.error('Erro detalhado ao buscar assistentes:', err);
      throw err; // Relança para a UI tratar
  }
}

// <<< NOVA FUNÇÃO para adicionar assistente >>>
/**
* Envia os dados de um novo assistente para o backend.
* @param {string} username Nome de usuário do novo assistente.
* @param {string} password Senha do novo assistente.
* @returns {Promise<Object>} Uma promessa que resolve com os dados do assistente criado.
*/
export async function addAssistant(username, password) {
  console.log(`Tentando adicionar assistente: ${username}`);
  const headers = createAuthHeaders();
  if (!headers['Authorization']) {
      throw new Error("Token de autenticação não encontrado.");
  }

  try {
      const response = await fetch(API_ASSISTANTS_URL, { // <<< Usa URL do config >>>
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ username, password }) // Envia username e password
      });

      const data = await response.json(); // Tenta ler JSON mesmo em erro
      if (!response.ok) {
          throw new Error(data.error || `Erro ${response.status}`);
      }
      console.log("Assistente adicionado com sucesso:", data.assistant);
      return data; // Retorna a resposta completa de sucesso { success: true, message: ..., assistant: {...} }
  } catch (err) {
      console.error('Erro detalhado ao adicionar assistente:', err);
      throw err; // Relança para a UI tratar
  }
}


// --- Funções API (dentro deste arquivo por enquanto, idealmente mover para api.js) ---


/** Busca a lista de clientes */

export async function getClients() {
    console.log("Buscando lista de clientes...");
    const headers = createAuthHeaders();
    if (!headers['Authorization']) throw new Error("Token não encontrado.");

    const response = await fetch(API_CLIENTS_URL, { method: 'GET', headers });
    if (!response.ok) {
        let errorMsg = `Erro ${response.status} ao buscar clientes.`;
        try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch (e) {}
        throw new Error(errorMsg);
    }
    const data = await response.json();
    console.log("Clientes recebidos:", data.clients);
    return data.clients || [];
}

/** Adiciona um novo cliente */
export async function addClient(name, cpf, dob) {
    console.log(`Tentando adicionar cliente: ${name}`);
    const headers = createAuthHeaders();
    if (!headers['Authorization']) throw new Error("Token não encontrado.");

    const body = { name };
    if (cpf) body.cpf = cpf.replace(/\D/g, ''); // Envia CPF limpo
    if (dob) body.dob = dob; // Envia data no formato YYYY-MM-DD

    const response = await fetch(API_CLIENTS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status}`);
    }
    console.log("Cliente adicionado:", data.client);
    return data; // Retorna { success: true, message: ..., client: {...} }
}