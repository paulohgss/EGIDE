// js/api.js

import { ROLES, BASE_PATH, API_URL } from './config.js';
import { AppState } from './state.js';
import { showError, showProgress, clearProgress } from './ui.js'; // Funções da UI
import { i18nInstance } from './i18n.js';

// Função delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function callBotAPI(role, userMessage, session_id = null, user_id = null, retries = 3) {
  console.log(`Chamando backend para ${role} (Session: ${session_id}, User: ${user_id})...`);
  showProgress('infoProcessing', 'Processando requisição para {{role}}...', { role });

  let success = false; // <<< NOVO: Flag para rastrear sucesso

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

      const headers = {
        'Content-Type': 'application/json'
      };
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const body = { role, message: userMessage };
      if (session_id) body.session_id = session_id;
      if (user_id) body.user_id = user_id; // Envia user_id se disponível

      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Tentativa de ler o corpo do erro ANTES de lançar o erro
        let errorBodyText = `Erro ${response.status} sem corpo detalhado.`;
        try {
            errorBodyText = await response.text(); // Tenta ler como texto
        } catch (readError) {
             console.warn("Não foi possível ler o corpo da resposta de erro:", readError);
        }
        console.error(`Backend Error Body (${response.status}):`, errorBodyText);
        // Lança um erro com o status para o catch tratar
        throw new Error(`${response.status}`);
      }

      const data = await response.json();
      console.log(`Resposta do backend recebida (${role}):`, data);

      // Verifica se a resposta da OpenAI está no formato esperado
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        success = true; // <<< AJUSTE: Marca como sucesso
         // Verifica se o backend gerou um novo session ID e atualiza o estado se necessário
         if (data.generated_session_id && AppState.currentSessionId !== data.generated_session_id) {
             console.log(`Atualizando session ID no estado para: ${data.generated_session_id}`);
             AppState.currentSessionId = data.generated_session_id;
         }
        return data.choices[0].message.content.trim(); // Retorna o resultado
      } else {
        // A resposta do backend veio OK (status 200), mas o JSON não tem o formato esperado
         console.error("Resposta do backend com status OK, mas formato inesperado:", data);
         const errorMessage = data?.error?.message || 'Resposta inesperada ou vazia do backend.';
         // Lança um erro para ser pego pelo catch (pode não ser ideal, talvez tratar diferente?)
         throw new Error(errorMessage);
      }

    } catch (err) { // 'err' só existe aqui
      console.error(`Tentativa ${attempt} falhou para ${role}:`, err);
      success = false; // Garante que a flag é false em caso de erro

      // Se for a última tentativa, mostra o erro e relança para o main.js tratar
      if (attempt === retries) {
        if (err.name === 'AbortError') {
          showError('timeoutError', 'A requisição para {{role}} demorou muito. Tente novamente ou verifique a conexão.', { role });
        } else if (err.message.match(/^\d{3}$/)) { // Erro com código de status HTTP
           // Tenta pegar uma mensagem mais descritiva do backend se disponível no erro
           const backendErrorMsg = err.error || `Erro ${err.message} no backend.`;
           showError('apiError', backendErrorMsg, { status: err.message });
        } else { // Outros erros (rede, formato inesperado, etc.)
          showError('fetchError', `Erro ao buscar dados: ${err.message}`, { message: err.message });
        }
        throw err; // Relança o erro para ser pego no mainCaseFlow (ou onde for chamado)
      }

      // Espera um pouco antes de tentar novamente (backoff exponencial simples)
      await delay(1000 * attempt);

    } finally {
      // Limpa a mensagem de progresso se for a última tentativa OU se foi bem-sucedido
      // <<< AJUSTE: Usa a flag 'success' em vez de 'err' >>>
      if (attempt === retries || success) {
        clearProgress();
      }
    }
  }
   // Se chegou aqui (após todas as retries falharem sem relançar erro - o que não deveria acontecer com o throw), retorna erro.
   // Isso é mais uma garantia.
   throw new Error(`Falha ao chamar API para ${role} após ${retries} tentativas.`);
}

// Função getSessionHistory permanece igual
export async function getSessionHistory(session_id) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

     // Constrói a URL base removendo /api/call-bot e adicionando o novo caminho
     const baseUrl = API_URL.replace('/api/call-bot', ''); // Assume que API_URL termina com /api/call-bot
     const historyUrl = `${baseUrl}/api/session-history/${session_id}`;
     console.log(`Buscando histórico em: ${historyUrl}`);


    const response = await fetch(historyUrl, { headers });

    if (response.status === 404) {
        console.log(`Histórico não encontrado para session_id: ${session_id}`);
        return []; // Retorna array vazio se não encontrado (não é um erro fatal)
    }
    if (!response.ok) {
      // Tenta ler a mensagem de erro do corpo da resposta
      let errorMsg = `Erro ${response.status} ao recuperar histórico`;
      try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
      } catch(e) { /* Ignora se não conseguir ler o JSON */ }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.history || []; // Retorna o histórico ou array vazio

  } catch (err) {
    console.error('Erro ao recuperar histórico:', err);
    showError('fetchError', `Erro ao recuperar histórico: ${err.message}`);
    return []; // Retorna array vazio em caso de erro
  }
}