// frontend/js/logs.js
import { DOM } from './dom-elements.js';
import { AppState } from './state.js';
import { i18nInstance } from './i18n.js';
import { getBotLogPrefix } from './i18n.js';
import { updateElementVisibility, escapeHtml } from './ui.js'; // Adicionado escapeHtml

export function addToHistoryAndLog(actor, text) {
    if (!text) return;

    const timestamp = new Date().toISOString();
    const t = i18nInstance.t.bind(i18nInstance);

    const logRoleName = actor === 'usuario'
        ? t('userLogPrefixSimple', 'Usuário')
        : actor.charAt(0).toUpperCase() + actor.slice(1);
    AppState.logs.push({ bot: logRoleName, texto: text });

    const historyPrefix = actor === 'usuario'
        ? t('userLogPrefix', 'Usuário')
        : getBotLogPrefix(actor);
    AppState.historicoConversa += `${historyPrefix}:\n${text}\n\n`;

    renderLogs();
}

// frontend/js/logs.js
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
            const logElement = document.createElement('div');
            logElement.className = `log-entry mb-2 log-${log.bot.toLowerCase()} border rounded p-3 bg-light`;
            
            // Formatar o texto para melhor legibilidade
            let formattedText = escapeHtml(log.texto)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Negrito para **texto**
                .replace(/\n/g, '<br>'); // Quebras de linha

            // Adicionar um título para cada log
            logElement.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <strong class="me-2">${getBotLogPrefix(log.bot)}:</strong>
                    <span class="text-muted small">Log ${index + 1}</span>
                </div>
                <div class="log-content" style="white-space: pre-wrap; font-family: monospace;">${formattedText}</div>
            `;
            DOM.logsIndividuais.appendChild(logElement);
            console.log(`[renderLogs] Adicionado log ${index + 1}:`, logElement.outerHTML);
        });
        DOM.logsIndividuais.style.display = 'block';
        updateElementVisibility(DOM.logsIndividuais, true);
        console.log("[renderLogs] Logs renderizados com sucesso em #logsIndividuais, conteúdo:", DOM.logsIndividuais.innerHTML);
        console.log("[renderLogs] Classe de #logsIndividuais:", DOM.logsIndividuais.className);
    } else {
        DOM.logsIndividuais.innerHTML = `<div class="alert alert-info">${t('noConversation', 'Nenhuma conversa disponível.')}</div>`;
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
        } else if (entry.type === 'bot_response') {
            prefix = getBotLogPrefix(entry.role);
        } else {
            console.warn("Tipo de entrada desconhecido no histórico do backend:", entry.type);
            return '';
        }
        return `${prefix}:\n${content || ''}`;
    }).filter(Boolean).join('\n\n');
}

// frontend/js/logs.js
export function formatBackendHistoryToLogs(backendHistory) {
    if (!Array.isArray(backendHistory)) return [];
    const logs = [];
    const t = i18nInstance.t.bind(i18nInstance);
    const userLogName = t('userLogPrefixSimple', 'Usuário');

    backendHistory.forEach(entry => {
        let logBotName = '';
        let logText = entry.content || '';

        if (entry.type === 'user_message_to_bot') {
            // Apenas incluir a primeira mensagem do usuário (não mensagens internas)
            if (logs.length === 0) {
                logBotName = userLogName;
                logs.push({ bot: logBotName, texto: logText });
            }
        } else if (entry.type === 'bot_response' && entry.role) {
            logBotName = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
            logs.push({ bot: logBotName, texto: logText });
        }
    });
    return logs;
}