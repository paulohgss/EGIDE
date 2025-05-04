// add-attendance.js

import { initializeI18n, i18nInstance, getT, escapeHtml } from './i18n.js';
import { DOM, initializeDOM } from './dom-elements.js';
import { addAttendance } from './api.js';

function showMessage(message, isSuccess = false) {
    const attendanceMessage = document.getElementById('attendance-message');
    if (attendanceMessage) {
        attendanceMessage.textContent = message;
        attendanceMessage.classList.remove('d-none', isSuccess ? 'alert-danger' : 'alert-success');
        attendanceMessage.classList.add(isSuccess ? 'alert-success' : 'alert-danger');
    } else {
        console.warn('Elemento #attendance-message não encontrado para exibir mensagem.');
    }
}

function clearMessage() {
    const attendanceMessage = document.getElementById('attendance-message');
    if (attendanceMessage) {
        attendanceMessage.textContent = '';
        attendanceMessage.classList.add('d-none');
    }
}

function validateForm() {
    const t = getT();
    const description = document.getElementById('attendance-description')?.value.trim();
    const purpose = document.getElementById('clientPurpose')?.value;
    const purposeDetail = document.getElementById('clientPurposeDetail')?.value.trim();

    if (!description) {
        showMessage(t('errorDescriptionRequired', 'Por favor, insira a descrição do atendimento.'), false);
        return false;
    }
    if (!purpose) {
        showMessage(t('errorPurposeRequired', 'Por favor, selecione o propósito do atendimento.'), false);
        return false;
    }
    if (purpose === 'Outro' && !purposeDetail) {
        showMessage(t('errorPurposeDetailRequired', 'Por favor, descreva o propósito com suas palavras.'), false);
        return false;
    }

    // Salvar no sessionStorage para uso em chat.js
    sessionStorage.setItem('selectedPurpose', purpose);
    sessionStorage.setItem('selectedPurposeDetail', purposeDetail);
    return true;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('add-attendance.js: Iniciando carregamento da página.');

    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('add-attendance.js: Token não encontrado. Redirecionando para login.');
        window.location.href = 'login.html';
        return;
    }

    // Inicializar i18n fora do bloco try para garantir que t esteja definido
    let t = () => 'Erro: i18n não inicializado';
    try {
        console.log('add-attendance.js: Inicializando i18n...');
        await initializeI18n();
        if (!i18nInstance || typeof i18nInstance.t !== 'function') {
            console.error('add-attendance.js: i18next não inicializado corretamente.');
            throw new Error('i18next não está inicializado corretamente.');
        }
        console.log('add-attendance.js: i18n inicializado com sucesso.');
        t = getT();
    } catch (err) {
        console.error('add-attendance.js: Erro ao inicializar i18n:', err);
        showMessage('Erro ao carregar configurações de idioma.', false);
        return;
    }

    try {
        // Verificar clientId
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

        // Verificar elementos do DOM manualmente
        DOM.pageTitle = document.getElementById('page-title');
        DOM.attendanceForm = document.getElementById('attendance-form');
        DOM.attendanceDescription = document.getElementById('attendance-description');
        DOM.attendanceMessage = document.getElementById('attendance-message');
        DOM.clientPurpose = document.getElementById('clientPurpose');
        DOM.clientPurposeDetail = document.getElementById('clientPurposeDetail');

        if (!DOM.pageTitle || !DOM.attendanceForm || !DOM.attendanceDescription || !DOM.attendanceMessage || !DOM.clientPurpose || !DOM.clientPurposeDetail) {
            console.error('add-attendance.js: Elementos do DOM ausentes:', {
                pageTitle: !!DOM.pageTitle,
                attendanceForm: !!DOM.attendanceForm,
                attendanceDescription: !!DOM.attendanceDescription,
                attendanceMessage: !!DOM.attendanceMessage,
                clientPurpose: !!DOM.clientPurpose,
                clientPurposeDetail: !!DOM.clientPurposeDetail
            });
            throw new Error('Falha ao inicializar elementos do DOM.');
        }

        // Atualizar título da página
        DOM.pageTitle.textContent = `${t('addAttendance', 'Adicionar Atendimento')} - ${escapeHtml(clientName)}`;

        // Configurar botão "Voltar"
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.href = `client-sessions.html?clientId=${encodeURIComponent(clientId)}&clientName=${encodeURIComponent(clientName)}`;
            console.log(`add-attendance.js: Botão 'Voltar' configurado para: ${backButton.href}`);
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

            if (!validateForm()) {
                console.warn('add-attendance.js: Validação do formulário falhou.');
                return;
            }

            const description = DOM.attendanceDescription.value.trim();
            const purpose = DOM.clientPurpose.value;
            const purposeDetail = DOM.clientPurposeDetail.value.trim();

            const submitButton = DOM.attendanceForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    ${t('saving', 'Salvando...')}
                `;
            }

            try {
                console.log('add-attendance.js: Enviando atendimento para a API...', { clientId, description, purpose, purposeDetail });
                await addAttendance(clientId, description, purpose, purposeDetail);
                console.log('add-attendance.js: Atendimento cadastrado com sucesso.');
                showMessage(t('attendanceAddedSuccess', 'Atendimento cadastrado com sucesso!'), true);
                DOM.attendanceDescription.value = '';
                DOM.clientPurpose.value = '';
                DOM.clientPurposeDetail.value = '';

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
        showMessage('Erro ao carregar a página de atendimento.', false);
    }
});