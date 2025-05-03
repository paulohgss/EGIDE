import { AppState, resetCaseState } from './state.js';
import { DOM } from './dom-elements.js';
import { resetUIForNewCase, updateElementVisibility } from './ui.js';
import { getBotLogPrefix, i18nInstance } from './i18n.js';

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

export function renderLogs() {
    if (!DOM.logsIndividuais) {
        console.error("[renderLogs] Elemento #logsIndividuais não encontrado no DOM.");
        return;
    }
    const t = i18nInstance.t.bind(i18nInstance);
    const userLogName = t('userLogPrefixSimple', 'Usuário');

    console.log(`[renderLogs] Total de logs em AppState.logs: ${AppState.logs.length}`);
    console.log(`[renderLogs] Filtro atual (AppState.filtroAtual): ${AppState.filtroAtual}`);

    const filteredLogs = AppState.logs.filter(log =>
        AppState.filtroAtual === 'ALL' || log.bot === AppState.filtroAtual || (AppState.filtroAtual === 'Usuário' && log.bot === userLogName)
    );
    console.log(`[renderLogs] Logs após filtro (${filteredLogs.length} entradas):`, filteredLogs);

    if (filteredLogs.length > 0) {
        DOM.logsIndividuais.innerHTML = filteredLogs.map(log => `
            <div class="log-entry mb-2">
                <strong>${log.bot}:</strong>
                <pre class="log-text">${escapeHtml(log.texto)}</pre>
            </div>
        `).join('');
        updateElementVisibility(DOM.logsIndividuais, true);
        console.log("[renderLogs] Logs renderizados com sucesso em #logsIndividuais.");
    } else {
        DOM.logsIndividuais.innerHTML = '';
        updateElementVisibility(DOM.logsIndividuais, false);
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

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
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

export function formatBackendHistoryToLogs(backendHistory) {
    if (!Array.isArray(backendHistory)) return [];
    const logs = [];
    const t = i18nInstance.t.bind(i18nInstance);
    const userLogName = t('userLogPrefixSimple', 'Usuário');

    backendHistory.forEach(entry => {
        let logBotName = '';
        let logText = entry.content || '';

        if (entry.type === 'user_message_to_bot') {
            logBotName = userLogName;
            logs.push({ bot: logBotName, texto: logText });
        } else if (entry.type === 'bot_response' && entry.role) {
            logBotName = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
            logs.push({ bot: logBotName, texto: logText });
        }
    });
    return logs;
}