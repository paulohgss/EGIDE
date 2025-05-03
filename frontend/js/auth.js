// frontend/js/auth.js

// URLs dos endpoints do backend (ajuste se necessário)
const API_LOGIN_URL = 'http://localhost:3000/api/login';
const API_REGISTER_URL = 'http://localhost:3000/api/register';

// Seletores de elementos comuns das páginas de auth
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password'); // Apenas no registro
const errorMessageDiv = document.getElementById('auth-error-message');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

/**
 * Exibe uma mensagem de erro na área designada.
 * @param {string} message A mensagem de erro a ser exibida.
 */
function showAuthError(message) {
    if (errorMessageDiv) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.classList.remove('d-none'); // Mostra a div de erro
    } else {
        console.error("Elemento de erro #auth-error-message não encontrado no DOM.");
    }
}

/**
 * Limpa a mensagem de erro.
 */
function clearAuthError() {
    if (errorMessageDiv) {
        errorMessageDiv.textContent = '';
        errorMessageDiv.classList.add('d-none'); // Esconde a div de erro
    }
}

/**
 * Lida com a submissão do formulário de Login.
 * @param {Event} event O evento de submissão do formulário.
 */
async function handleLogin(event) {
    event.preventDefault(); // Impede o envio padrão do formulário
    clearAuthError(); // Limpa erros anteriores

    const username = usernameInput?.value;
    const password = passwordInput?.value;

    if (!username || !password) {
        showAuthError('Por favor, preencha o usuário e a senha.');
        return;
    }

    console.log('Tentando fazer login com:', username);
    // TODO: Adicionar estado de carregamento/spinner ao botão

    try {
        const response = await fetch(API_LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            // Se a resposta não for OK, pega a mensagem de erro do backend ou usa uma padrão
            throw new Error(data.error || `Erro ${response.status}`);
        }

        // Login bem-sucedido!
        console.log('Login bem-sucedido:', data);
        if (data.token && data.user_id) {
            // Salva o token e user_id no localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user_id', data.user_id); // Salva o user_id também
            // Redireciona para a página principal
            window.location.href = 'index.html'; // ou '/index.html' dependendo de como seu servidor está configurado
        } else {
            throw new Error('Resposta de login inválida recebida do servidor.');
        }

    } catch (error) {
        console.error('Erro no login:', error);
        showAuthError(error.message || 'Não foi possível fazer login. Verifique suas credenciais.');
        // TODO: Remover estado de carregamento/spinner do botão
    }
}

/**
 * Lida com a submissão do formulário de Registro.
 * @param {Event} event O evento de submissão do formulário.
 */
async function handleRegister(event) {
    event.preventDefault();
    clearAuthError();

    const username = usernameInput?.value;
    const password = passwordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;

    // Validações básicas no frontend
    if (!username || !password || !confirmPassword) {
        showAuthError('Por favor, preencha todos os campos.');
        return;
    }
    if (password.length < 6) {
        showAuthError('A senha deve ter pelo menos 6 caracteres.');
        return;
    }
    if (password !== confirmPassword) {
        showAuthError('As senhas não coincidem.');
        return;
    }

    console.log('Tentando registrar usuário:', username);
    // TODO: Adicionar estado de carregamento/spinner ao botão

    try {
        const response = await fetch(API_REGISTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json(); // Tenta ler o corpo da resposta mesmo se não for OK

        if (!response.ok) {
             // Usa a mensagem de erro do backend (ex: "Usuário já existe") ou uma padrão
            throw new Error(data.error || `Erro ${response.status}`);
        }

        // Registro bem-sucedido!
        console.log('Registro bem-sucedido:', data);
        alert('Conta criada com sucesso! Você será redirecionado para o login.'); // Mensagem simples por enquanto
        // Redireciona para a página de login após sucesso
        window.location.href = 'login.html';

    } catch (error) {
        console.error('Erro no registro:', error);
        showAuthError(error.message || 'Não foi possível criar a conta.');
         // TODO: Remover estado de carregamento/spinner do botão
    }
}

// --- Adiciona os Event Listeners ---
// Verifica se estamos na página de login ou registro antes de adicionar o listener
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
    console.log("Listener de login adicionado.");
} else if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
    console.log("Listener de registro adicionado.");
} else {
    // Não estamos em nenhuma das páginas de autenticação, ou os forms não foram encontrados
    // console.log("Nenhum formulário de autenticação encontrado nesta página.");
}