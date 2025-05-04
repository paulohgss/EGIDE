// pdf.js

import { AppState } from './state.js';
import { showError } from './ui.js';
import { i18nInstance } from './i18n.js';

export async function downloadConversationAsPdf() {
    let jsPDF;
    try {
        if (typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF !== 'undefined') {
            jsPDF = window.jspdf.jsPDF;
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onerror = async () => {
                console.warn('Falha ao carregar jsPDF do CDN. Tentando fallback local.');
                const response = await fetch('/js/jspdf.min.js');
                const fallbackScript = document.createElement('script');
                fallbackScript.text = await response.text();
                document.head.appendChild(fallbackScript);
            };
            document.head.appendChild(script);
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    if (window.jspdf && window.jspdf.jsPDF) {
                        resolve();
                    } else {
                        reject(new Error('jsPDF não definido.'));
                    }
                };
                script.onerror = reject;
            });
            jsPDF = window.jspdf.jsPDF;
        }

        const doc = new jsPDF({
            orientation: 'p',
            unit: 'pt',
            format: 'a4'
        });

        const conversationHistory = AppState.historicoConversa;
        if (!conversationHistory || conversationHistory.trim() === "") {
            console.warn("Tentativa de gerar PDF sem histórico de conversa.");
            if (DOM.errorMessage) {
                showError("errorMessageDefault", "Nenhum histórico para gerar PDF.");
            } else {
                console.error("Elemento #errorMessage não encontrado no DOM.");
                alert("Nenhum histórico para gerar PDF.");
            }
            return;
        }

        const margin = 40;
        const pageInfo = doc.internal.pageSize;
        const pageWidth = pageInfo.getWidth();
        const pageHeight = pageInfo.getHeight();
        const usableWidth = pageWidth - margin * 2;
        let cursorY = margin;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        const isI18nReady = i18nInstance && typeof i18nInstance.t === 'function';
        const title = isI18nReady ? i18nInstance.t("pdfHistoryTitle", "Histórico da Conversa") : "Histórico da Conversa";
        const splitTitle = doc.splitTextToSize(title, usableWidth);
        doc.text(splitTitle, margin, cursorY);
        cursorY += (splitTitle.length * doc.getTextDimensions(title).h * 1.2) + 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        const entries = conversationHistory.trim().split(/\n\n(?=[👤🩺📝📊🧑‍⚖️])/);
        for (const entry of entries) {
            if (!entry.trim()) continue;
            const lines = entry.split('\n');
            const botLineText = lines[0] || "";
            const contentText = lines.slice(1).join('\n').trim();
            const lineHeight = doc.getTextDimensions('M').h * 1.2;
            const botLineHeight = doc.getTextDimensions(botLineText).h * 1.2;
            const emojiRegex = /^[👤🩺📝📊🧑‍⚖️]\s*/;
            const cleanBotLineText = botLineText.replace(emojiRegex, '');
            const splitBotLine = doc.splitTextToSize(cleanBotLineText, usableWidth);
            const splitContentLines = doc.splitTextToSize(contentText, usableWidth);
            const requiredHeight = (splitBotLine.length * botLineHeight) + (splitContentLines.length * lineHeight) + 10;

            if (cursorY > margin && (cursorY + requiredHeight) > (pageHeight - margin)) {
                doc.addPage();
                cursorY = margin;
            }

            doc.setFont('helvetica', 'bold');
            splitBotLine.forEach(line => {
                if (cursorY + botLineHeight > pageHeight - margin) {
                    doc.addPage();
                    cursorY = margin;
                }
                doc.text(line, margin, cursorY);
                cursorY += botLineHeight;
            });
            doc.setFont('helvetica', 'normal');
            splitContentLines.forEach(line => {
                if (cursorY + lineHeight > pageHeight - margin) {
                    doc.addPage();
                    cursorY = margin;
                }
                doc.text(line, margin, cursorY);
                cursorY += lineHeight;
            });
            cursorY += 10;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        doc.save(`historico_multibot_${timestamp}.pdf`);
    } catch (error) {
        console.error("Erro ao carregar ou salvar o PDF:", error);
        if (DOM.errorMessage) {
            showError("errorMessageDefault", "Falha ao gerar o PDF.");
        } else {
            console.error("Elemento #errorMessage não encontrado no DOM.");
            alert("Falha ao gerar o PDF.");
        }
    }
}


// fim pdf.js