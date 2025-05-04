// frontend/js/add-attendance.js
import { initializeI18n, i18nInstance, getT, escapeHtml } from './i18n.js';
import { DOM, initializeDOM } from './dom-elements.js';
import { addAttendance } from './api.js';

function showMessage(message, isSuccess = false) {
    if (DOM.attendanceMessage) {
        DOM.attendanceMessage.textContent = message;
        DOM.attendanceMessage.classList.remove('d-none', isSuccess ? 'alert-danger' : 'alert-success');
        DOM.attendanceMessage.classList.add(isSuccess ? 'alert-success' : 'alert-danger');
    }
}

function clearMessage() {
    if (DOM.attendanceMessage) {
        DOM.attendanceMessage.textContent = '';
        DOM.attendanceMessage.classList.add('d-none');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('add-attendance.js: Iniciando carregamento da página.');

    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('add-attendance.js: Token não encontrado. Redirecionando para login.');
        window.location.href = 'login.html';
        return;
    }

    try {
        // Inicializar i18n primeiro
        console.log('add-attendance.js: Inicializando i18n...');
        await initializeI18n();
        if (!i18nInstance || typeof i18nInstance.t !== 'function') {
            console.error('add-attendance.js: i18next não inicializado corretamente.');
            throw new Error('i18next não está inicializado corretamente.');
        }
        console.log('add-attendance.js: i18n inicializado com sucesso.');

        const t = getT();

        // Verificar clientId após inicializar i18n
        const urlParams = new URLSearchParams(window.location.search);
        const clientId = urlParams.get('clientId');
        const clientName = urlParams.get('clientName') || 'Cliente';

        if (!clientId) {
            console.warn('add-attendance.js: clientId não encontrado na URL. Redirecionando para client-sessions.html.');
            showMessage(t('errorClientNotFound', 'Erro: ID do cliente não especificado na URL.'), false);
            setTimeout(() => {
                window.location.href = 'client-sessions.html';
            }, 1500);
            return;
        }

        // Inicializar DOM
        console.log('add-attendance.js: Inicializando DOM...');
        initializeDOM();
        if (!DOM.pageTitle || !DOM.attendanceForm || !DOM.attendanceDescription || !DOM.attendanceMessage) {
            console.error('add-attendance.js: Elementos do DOM ausentes:', {
                pageTitle: !!DOM.pageTitle,
                attendanceForm: !!DOM.attendanceForm,
                attendanceDescription: !!DOM.attendanceDescription,
                attendanceMessage: !!DOM.attendanceMessage
            });
            throw new Error('Falha ao inicializar elementos do DOM.');
        }

        // Atualizar título da página
        DOM.pageTitle.textContent = `${t('addAttendance', 'Adicionar Atendimento')} - ${escapeHtml(clientName)}`;

        // Configurar botão "Voltar"
        if (DOM.backButton) {
            DOM.backButton.href = `client-sessions.html?clientId=${encodeURIComponent(clientId)}&clientName=${encodeURIComponent(clientName)}`;
            console.log(`add-attendance.js: Botão 'Voltar' configurado para: ${DOM.backButton.href}`);
        }

        // Aplicar traduções dinâmicas
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = t(key, key);
        });

        // Configurar formulário
        console.log('add-attendance.js: Configurando listener do formulário...');
        DOM.attendanceForm.addEventListener('submit', async (event) => {
            console.log('add-attendance.js: Evento submit disparado.');
            event.preventDefault();
            clearMessage();

            const description = DOM.attendanceDescription.value.trim();
            if (!description) {
                console.warn('add-attendance.js: Descrição vazia.');
                showMessage(t('descriptionRequired', 'A descrição do atendimento é obrigatória.'), false);
                return;
            }

            const submitButton = DOM.attendanceForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    ${t('saving', 'Salvando...')}
                `;
            }

            try {
                console.log('add-attendance.js: Enviando atendimento para a API...', { clientId, description });
                await addAttendance(clientId, description);
                console.log('add-attendance.js: Atendimento cadastrado com sucesso.');
                showMessage(t('attendanceAddedSuccess', 'Atendimento cadastrado com sucesso!'), true);
                DOM.attendanceDescription.value = ''; // Limpar o campo

                // Redirecionar após 1,5 segundos
                setTimeout(() => {
                    console.log('add-attendance.js: Redirecionando para client-sessions.html...');
                    window.location.href = `client-sessions.html?clientId=${encodeURIComponent(clientId)}&clientName=${encodeURIComponent(clientName)}`;
                }, 1500);
            } catch (error) {
                console.error('add-attendance.js: Erro ao cadastrar atendimento:', error);
                showMessage(t('errorAddingAttendance', 'Erro ao cadastrar atendimento: ') + error.message, false);
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = t('addAttendanceButton', 'Cadastrar Atendimento');
                }
            }
        });

        console.log('add-attendance.js: Página de adicionar atendimento carregada para cliente:', clientName, '(ID:', clientId, ')');
    } catch (err) {
        console.error('add-attendance.js: Erro ao inicializar a página:', err, err.stack);
        const t = getT();
        showMessage(t('errorAppInit', 'Erro ao carregar a página de atendimento.'), false);
    }
});