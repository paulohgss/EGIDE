// frontend/js/auth.js

import { API_LOGIN_URL, API_REGISTER_URL } from './config.js';

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


async function handleLogin(event) {
    event.preventDefault();
    clearAuthError();
    const username = usernameInput?.value;
    const password = passwordInput?.value;
    if (!username || !password) {
        showAuthError('Por favor, preencha o usuário e a senha.');
        return;
    }
    console.log('Tentando fazer login com:', username);
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = 'Carregando...';
    try {
        const response = await fetch(API_LOGIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Erro ${response.status}`);
        }
        console.log('Login bem-sucedido:', data);
        if (data.token && data.user_id) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user_id', data.user_id);
            window.location.href = 'index.html';
        } else {
            throw new Error('Resposta de login inválida recebida do servidor.');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showAuthError(error.message || 'Não foi possível fazer login. Verifique suas credenciais.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Entrar';
    }
}

/**
 * Lida com a submissão do formulário de Login.
 * @param {Event} event O evento de submissão do formulário.
 */
async function handleRegister(event) {
    event.preventDefault();
    clearAuthError();
    const username = usernameInput?.value;
    const password = passwordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;
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
    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = 'Carregando...';
    try {
        const response = await fetch(API_REGISTER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Erro ${response.status}`);
        }
        console.log('Registro bem-sucedido:', data);
        alert('Conta criada com sucesso! Você será redirecionado para o login.');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Erro no registro:', error);
        showAuthError(error.message || 'Não foi possível criar a conta.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Registrar';
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

// fim auth.js