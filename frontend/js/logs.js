// logs.js - Funções de logging

import { AppState } from './state.js';
import { DOM } from './dom-elements.js';
import { updateElementVisibility, showError } from './ui.js';
import { getBotLogPrefix, i18nInstance } from './i18n.js';

export function addToHistoryAndLog(role, text) {
    const prefix = getBotLogPrefix(role);
    AppState.historicoConversa += `${prefix}:\n${text}\n\n`;
    AppState.addLog({ bot: role.charAt(0).toUpperCase() + role.slice(1), texto: text });
    renderLogs();
}

export function renderLogs() {
  if (!DOM.logsIndividuais) return;

  DOM.logsIndividuais.innerHTML = "";
  const filteredLogs = AppState.filtroAtual === "ALL"
    ? AppState.logs
    : AppState.logs.filter(log => log.bot === AppState.filtroAtual);

  if (filteredLogs.length === 0) {
    updateElementVisibility(DOM.logsIndividuais, false);
    return;
  }

  const originalIndices = filteredLogs.map(log => AppState.logs.indexOf(log));

  filteredLogs.forEach((log, index) => {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const logPrefix = getBotLogPrefix(log.bot.toLowerCase());
    const globalIndex = originalIndices[index] + 1;
    summary.textContent = `${logPrefix} #${globalIndex}`;
    const pre = document.createElement("pre");
    pre.textContent = log.texto;
    details.appendChild(summary);
    details.appendChild(pre);
    DOM.logsIndividuais.appendChild(details);
  });

  updateElementVisibility(DOM.logsIndividuais, true);
}

export function handleClearLogs() {
  AppState.clearLogs();
  renderLogs();
  if(DOM.respostaFinal) DOM.respostaFinal.textContent = '';
  updateElementVisibility(DOM.respostaFinal, false);
  updateElementVisibility(DOM.downloadPdfBtn, false);
  if(DOM.conversaInterna) DOM.conversaInterna.textContent = '';
  updateElementVisibility(DOM.conversaInterna, false);
}

export function exportLogs() {
  if (AppState.logs.length === 0) {
    showError("errorNoLogsToExport");
    return;
  }
  const logContent = AppState.logs.map((log, index) =>
    `--- Log #${index + 1} - ${getBotLogPrefix(log.bot.toLowerCase())} ---\n${log.texto}`
  ).join("\n\n");

  try {
      const blob = new Blob([logContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `multibot_logs_${timestamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  } catch (error) {
      console.error("Erro ao exportar logs:", error);
      showError("errorMessageDefault", "Falha ao exportar logs.");
  }
}