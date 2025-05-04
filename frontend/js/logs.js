import { DOM } from './dom-elements.js';
import { AppState } from './state.js';
import { i18nInstance } from './i18n.js';
import { getBotLogPrefix } from './i18n.js';
import { updateElementVisibility, escapeHtml } from './ui.js';

export function addToHistoryAndLog(actor, text, isFinalResponse = false) {
    if (!text) return;

    const timestamp = new Date().toISOString();
    const t = i18nInstance.t.bind(i18nInstance);

    const logRoleName = actor === 'usuario'
        ? t('userLogPrefixSimple', 'Usuário')
        : actor.charAt(0).toUpperCase() + actor.slice(1);
    AppState.logs.push({ bot: logRoleName, texto: text, isFinalResponse });

    const historyPrefix = actor === 'usuario'
        ? t('userLogPrefix', 'Usuário')
        : getBotLogPrefix(actor);
    AppState.historicoConversa += `${historyPrefix}:\n${text}\n\n`;

    renderLogs();
}

export function renderLogs() {
    if (!DOM.logsIndividuais) {
        console.error("[renderLogs] Elemento #logsIndividuais não encontrado no DOM. Verifique se initializeDOM foi chamado após DOMContentLoaded.");
        return;
    }
    const t = i18nInstance.t.bind(i18nInstance);
    const userLogName = t('userLogPrefixSimple', 'Usuário');

    console.log(`[renderLogs] Total de logs em AppState.logs: ${AppState.logs.length}`);
    console.log(`[renderLogs] Filtro atual (AppState.filtroAtual): ${AppState.filtroAtual}`);

    const filteredLogs = AppState.filtroAtual === 'ALL'
        ? AppState.logs
        : AppState.logs.filter(log => log.bot === AppState.filtroAtual || (AppState.filtroAtual === 'Usuário' && log.bot === userLogName));
    console.log(`[renderLogs] Logs após filtro (${filteredLogs.length} entradas):`, JSON.stringify(filteredLogs, null, 2));

    DOM.logsIndividuais.innerHTML = '';
    if (filteredLogs.length > 0) {
        filteredLogs.forEach((log, index) => {
            const isUser = log.bot === userLogName;
            const isFinal = log.isFinalResponse || false;
            const logElement = document.createElement('div');
            logElement.className = `chat-message mb-3 d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'} animate__animated animate__fadeInUp animate__faster`;
            
            let formattedText = escapeHtml(log.texto)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');

            logElement.innerHTML = `
                <div class="d-flex align-items-end ${isUser ? 'flex-row-reverse' : ''}">
                    <div class="chat-avatar ${isUser ? 'ms-2' : 'me-2'}">
                        <i class="fas ${isUser ? 'fa-user' : 'fa-robot'}"></i>
                    </div>
                    <div class="chat-bubble ${isUser ? 'bg-primary text-white' : 'bg-light border'} ${isFinal ? 'final-response' : ''} rounded p-3">
                        <div class="d-flex align-items-center mb-1">
                            <strong class="me-2">${getBotLogPrefix(log.bot)}</strong>
                            <span class="text-muted small">${new Date().toLocaleTimeString()}</span>
                        </div>
                        <div class="chat-content">${formattedText}</div>
                    </div>
                </div>
            `;
            DOM.logsIndividuais.appendChild(logElement);
            console.log(`[renderLogs] Adicionado log ${index + 1}:`, logElement.outerHTML);
        });
        DOM.logsIndividuais.style.display = 'block';
        updateElementVisibility(DOM.logsIndividuais, true);
        DOM.logsIndividuais.scrollTop = DOM.logsIndividuais.scrollHeight; // Rolar para o final
        console.log("[renderLogs] Logs renderizados com sucesso em #logsIndividuais, conteúdo:", DOM.logsIndividuais.innerHTML);
    } else {
        DOM.logsIndividuais.innerHTML = `<div class="alert alert-info text-center">${t('noConversation', 'Nenhuma conversa disponível.')}</div>`;
        updateElementVisibility(DOM.logsIndividuais, true);
        console.log("[renderLogs] Nenhum log para exibir após filtro.");
    }
}

export function handleClearLogs() {
    const t = i18nInstance.t.bind(i18nInstance);
    console.log("Limpando logs e resetando estado...");
    resetCaseState();
    resetUIForNewCase();
    renderLogs();
    if (DOM.entradaUsuario) DOM.entradaUsuario.value = '';
}

export function exportLogs() {
    const t = i18nInstance.t.bind(i18nInstance);
    if (!AppState.historicoConversa) {
        alert(t('errorNoHistoryToExport', 'Não há histórico para exportar.'));
        return;
    }
    const blob = new Blob([AppState.historicoConversa], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `historico_egide_${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function formatBackendHistoryToString(backendHistory) {
    if (!Array.isArray(backendHistory)) return "";
    const t = i18nInstance.t.bind(i18nInstance);
    return backendHistory.map(entry => {
        let prefix = '';
        let content = entry.content || '';
        if (entry.type === 'user_message_to_bot') {
            prefix = t('userLogPrefix', 'Usuário');
            if (entry.purpose || entry.purpose_detail) {
                content += '\n';
                if (entry.purpose) content += `Propósito: ${entry.purpose}\n`;
                if (entry.purpose_detail) content += `Detalhes do Propósito: ${entry.purpose_detail}`;
            }
        } else if (entry.type === 'bot_response') {
            prefix = getBotLogPrefix(entry.role);
        } else {
            console.warn("Tipo de entrada desconhecido no histórico do backend:", entry.type);
            return '';
        }
        return `${prefix}:\n${content || ''}`;
    }).filter(Boolean).join('\n\n');
}

export function formatBackendHistoryToLogs(backendHistory) {
    if (!Array.isArray(backendHistory)) return [];
    const t = i18nInstance.t.bind(i18nInstance);
    const userLogName = t('userLogPrefixSimple', 'Usuário');
    const logs = [];

    backendHistory.forEach(entry => {
        let logBotName = '';
        let logText = entry.content || '';
        let isFinalResponse = false;

        if (entry.type === 'user_message_to_bot') {
            logBotName = userLogName;
            if (entry.purpose || entry.purpose_detail) {
                logText += '\n';
                if (entry.purpose) logText += `Propósito: ${entry.purpose}\n`;
                if (entry.purpose_detail) logText += `Detalhes do Propósito: ${entry.purpose_detail}`;
            }
            logs.push({ bot: logBotName, texto: logText, isFinalResponse });
        } else if (entry.type === 'bot_response' && entry.role) {
            logBotName = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
            isFinalResponse = entry.role === 'supervisor' && !logText.includes('[PEDIDO_INFO]');
            logs.push({ bot: logBotName, texto: logText, isFinalResponse });
        }
    });

    return logs;
}