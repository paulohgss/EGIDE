// theme.js

import { DOM, initializeDOM } from './dom-elements.js';

export function initializeTheme() {
    if (!DOM.body || (!DOM.themeToggle && !DOM.themeToggleIndex)) {
        console.warn("[initializeTheme] DOM.body ou botões de tema não definidos. Chamando initializeDOM.");
        initializeDOM();
    }
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

export function toggleTheme() {
    if (!DOM.body) {
        console.error("[toggleTheme] DOM.body não definido. Não é possível alternar o tema.");
        return;
    }
    const currentTheme = DOM.body.classList.contains('dark-theme') ? 'dark' : 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function setTheme(theme) {
    if (!DOM.body) {
        console.error("[setTheme] DOM.body não definido. Não é possível aplicar o tema.");
        return;
    }
    DOM.body.classList.toggle('dark-theme', theme === 'dark');
    localStorage.setItem('theme', theme);
    const toggleButton = DOM.themeToggle || DOM.themeToggleIndex;
    if (toggleButton) {
        toggleButton.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}