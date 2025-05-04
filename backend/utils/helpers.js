// backend/utils/helpers.js
const fs = require('fs');
const path = require('path');

function getSystemPrompt(role) {
  const basePath = path.join(__dirname, '..', 'bases');
  const filePath = path.join(basePath, `base_${role}.txt`);
  const defaultPrompt = 'Você é um assistente útil.';

  try {
    if (fs.existsSync(filePath)) {
      const promptContent = fs.readFileSync(filePath, 'utf-8');
      return promptContent.trim() !== '' ? promptContent.trim() : defaultPrompt;
    } else {
      console.warn(`Arquivo de prompt não encontrado para role "${role}": ${filePath}. Usando prompt padrão.`);
      return defaultPrompt;
    }
  } catch (err) {
    console.error(`Erro ao ler arquivo de prompt para role "${role}" (${filePath}):`, err);
    return defaultPrompt;
  }
}

module.exports = { getSystemPrompt };