// pdf.js - Função para gerar PDF do Histórico da Conversa
import { AppState } from './state.js';
import { showError } from './ui.js';
import { i18nInstance } from './i18n.js';

/**
 * Gera e baixa um arquivo PDF contendo o histórico da conversa dos bots.
 * Remove emojis dos prefixos dos bots para evitar problemas de renderização/codificação no PDF.
 */
export function downloadConversationAsPdf() {
    // Verifica se a biblioteca jsPDF está carregada
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        showError("errorPdfLibNotLoaded"); // Chave i18n para erro
        console.error("jsPDF não está definida globalmente.");
        return;
    }
    const { jsPDF } = window.jspdf;

    // Inicializa o documento PDF (A4, retrato, unidades em pontos)
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
    });

    // Pega o histórico completo do estado da aplicação
    const conversationHistory = AppState.historicoConversa;

    // Verifica se há histórico para processar
    if (!conversationHistory || conversationHistory.trim() === "") {
        console.warn("Tentativa de gerar PDF sem histórico de conversa.");
        showError("errorMessageDefault", "Nenhum histórico para gerar PDF."); // Chave i18n genérica
        return;
    }

    // --- Configurações de Layout e Fonte ---
    const margin = 40; // Margem em pontos (ajuste conforme necessário)
    const pageInfo = doc.internal.pageSize;
    const pageWidth = pageInfo.getWidth();
    const pageHeight = pageInfo.getHeight();
    const usableWidth = pageWidth - margin * 2; // Largura útil real para o texto
    let cursorY = margin; // Posição vertical inicial (topo da página)

    // Define a fonte padrão - importante para consistência das métricas
    doc.setFont('helvetica', 'normal'); // Usando uma fonte padrão segura
    doc.setFontSize(10); // Tamanho de fonte padrão para o conteúdo

    // --- Título do Documento ---
    doc.setFontSize(16); // Tamanho maior para o título
    doc.setFont('helvetica', 'bold'); // Negrito para o título
    const title = i18nInstance.t("pdfHistoryTitle", "Histórico da Conversa"); // Obtém título traduzido
    const splitTitle = doc.splitTextToSize(title, usableWidth); // Quebra título se for muito longo
    doc.text(splitTitle, margin, cursorY); // Adiciona o título ao PDF
    // Calcula a altura ocupada pelo título e adiciona espaço
    cursorY += (splitTitle.length * doc.getTextDimensions(title).h * 1.2) + 10;
    doc.setFont('helvetica', 'normal'); // Volta para estilo normal
    doc.setFontSize(10); // Volta para tamanho padrão do conteúdo

    // --- Processamento do Histórico da Conversa ---
    // Divide o histórico em entradas individuais baseado nos prefixos dos bots/usuário
    // Regex: Procura por \n\n seguido por um dos emojis (lookahead positivo)
    const entries = conversationHistory.trim().split(/\n\n(?=[👤🩺📝📊🧑‍⚖️])/);

    for (const entry of entries) {
        if (!entry.trim()) continue; // Pula entradas vazias

        // Divide a entrada em linhas: primeira linha é identificação, resto é conteúdo
        const lines = entry.split('\n');
        const botLineText = lines[0] || ""; // Linha de identificação (ex: "🩺 Médico:")
        const contentText = lines.slice(1).join('\n').trim(); // Conteúdo da mensagem

        // Calcula a altura aproximada da linha para paginação
        const lineHeight = doc.getTextDimensions('M').h * 1.2; // Fator 1.2 para espaçamento entre linhas
        const botLineHeight = doc.getTextDimensions(botLineText).h * 1.2; // Altura para a linha de identificação

        // --- AJUSTE: Remover Emojis da Linha de Identificação ---
        // Regex para encontrar um dos emojis de bot/usuário no início da linha, seguido por espaço opcional
        const emojiRegex = /^[👤🩺📝📊🧑‍⚖️]\s*/;
        // Cria uma versão da linha de identificação SEM o emoji
        const cleanBotLineText = botLineText.replace(emojiRegex, '');
        // ------------------------------------------------------

        // --- Quebra de Linha (Wrapping) ---
        // Quebra a linha de identificação (JÁ SEM O EMOJI) se for muito longa
        const splitBotLine = doc.splitTextToSize(cleanBotLineText, usableWidth);
        // Quebra o conteúdo principal da mensagem
        const splitContentLines = doc.splitTextToSize(contentText, usableWidth);

        // --- Lógica de Paginação (Nível do Bloco) ---
        // Calcula a altura total estimada que este bloco (identificação + conteúdo) ocupará
        const requiredHeight = (splitBotLine.length * botLineHeight) + (splitContentLines.length * lineHeight) + 10; // +10 para espaço após o bloco

        // Verifica se o bloco INTEIRO cabe na página atual ANTES de começar a desenhar
        // Se não couber E não for o primeiro item na página, adiciona uma nova página
        if (cursorY > margin && (cursorY + requiredHeight) > (pageHeight - margin)) {
            doc.addPage(); // Adiciona nova página
            cursorY = margin; // Reseta o cursor para o topo da nova página
        }

        // --- Desenha a Linha de Identificação do Bot (Negrito e SEM Emoji) ---
        doc.setFont('helvetica', 'bold'); // Define negrito
        splitBotLine.forEach(line => { // Itera sobre as linhas quebradas da identificação (sem emoji)
            // Verificação de paginação INTRA-BLOCO (para cada linha da identificação)
            if (cursorY + botLineHeight > pageHeight - margin) {
                 // Adiciona nova página se esta linha específica não couber
                doc.addPage();
                cursorY = margin;
            }
            // Adiciona a linha (sem emoji) ao PDF
            doc.text(line, margin, cursorY);
            cursorY += botLineHeight; // Move o cursor para baixo
        });
        doc.setFont('helvetica', 'normal'); // Volta para estilo normal

        // --- Desenha o Conteúdo da Mensagem ---
        splitContentLines.forEach(line => { // Itera sobre as linhas quebradas do conteúdo
            // Verificação de paginação INTRA-BLOCO (para cada linha do conteúdo)
             if (cursorY + lineHeight > pageHeight - margin) {
                doc.addPage(); // Adiciona nova página se esta linha não couber
                cursorY = margin;
            }
            // Adiciona a linha de conteúdo ao PDF
            doc.text(line, margin, cursorY);
            cursorY += lineHeight; // Move o cursor para baixo
        });

        cursorY += 10; // Adiciona um espaço extra entre as entradas completas
    }

    // --- Salvamento do PDF ---
    try {
        // Gera um nome de arquivo com timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        doc.save(`historico_multibot_${timestamp}.pdf`); // Salva o arquivo
    } catch (error) {
        console.error("Erro ao salvar o PDF:", error);
        showError("errorMessageDefault", "Falha ao salvar o PDF."); // Chave i18n genérica
    }
}