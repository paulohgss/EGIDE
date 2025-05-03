// frontend/js/index-page.js

// Importa a chave do localStorage para limpar no logout (boa prática)
import { SESSION_ID_STORAGE_KEY } from './state.js';

/**
 * Lida com o evento de clique no link/botão de logout.
 */
function handleLogout() {
    console.log("Executando logout do painel principal...");
    // Remove credenciais e dados de sessão do localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem(SESSION_ID_STORAGE_KEY); // Remove o ID da última sessão também

    // Redireciona para a página de login
    window.location.href = 'login.html';
}

/**
 * Decodifica o payload de um token JWT (sem verificar a assinatura).
 * CUIDADO: Use isso apenas para ler dados públicos como 'username' ou 'role'
 * após a autenticação já ter sido validada pelo backend ou pelo middleware.
 * NÃO use para validação de segurança.
 * @param {string} token O token JWT.
 * @returns {object | null} O payload decodificado ou null se falhar.
 */
function decodeJwtPayload(token) {
    if (!token) return null;
    try {
        // O payload é a segunda parte do token (entre os pontos)
        const base64Url = token.split('.')[1];
        // Substitui caracteres para base64 padrão e decodifica
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Erro ao decodificar payload do JWT:", e);
        return null;
    }
}


// --- Inicialização da Página ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando painel principal (index.html)...");

    // 1. Verificar autenticação
    const token = localStorage.getItem('token');
    if (!token) {
        console.log("Nenhum token encontrado, redirecionando para login.");
        window.location.href = 'login.html';
        return; // Impede o resto de rodar
    }

    // 2. Exibir saudação (opcional, pega do localStorage ou decodifica do token)
    const userGreetingElement = document.getElementById('user-greeting');
    // Tenta pegar o username do payload do token para uma saudação mais amigável
    const payload = decodeJwtPayload(token);
    const username = payload?.username; // Usa o username do token se disponível

    if (userGreetingElement) {
        if (username) {
             userGreetingElement.textContent = `Olá, ${escapeHtml(username)}!`;
        } else {
            // Fallback para o user_id se não conseguir decodificar ou não tiver username
            const userId = localStorage.getItem('user_id');
            userGreetingElement.textContent = `Olá! (ID: ${userId || 'Usuário'})`;
        }
         userGreetingElement.classList.remove('d-none');
    }

    // 3. Adicionar listener ao botão de logout
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault(); // Previne a ação padrão do link '#'
            handleLogout();
        });
    } else {
        console.warn("Elemento #logout-link não encontrado.");
    }

    // 4. (FUTURO - Controle de Acesso) Mostrar/Esconder Gerenciar Assistentes baseado no Role
    const manageAssistantsCard = document.getElementById('manage-assistants-card');
    if (manageAssistantsCard) {
        const userRole = payload?.role; // Pega o role do payload decodificado
        if (userRole !== 'master') {
            console.log("Usuário não é master, escondendo opção 'Gerenciar Assistentes'.");
            manageAssistantsCard.classList.add('d-none'); // Esconde o card inteiro
        } else {
            console.log("Usuário é master, mostrando opção 'Gerenciar Assistentes'.");
            manageAssistantsCard.classList.remove('d-none'); // Garante que está visível
        }
    }


    console.log("Painel principal pronto.");
});

// Função auxiliar simples para escapar HTML (evita XSS básico)
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}