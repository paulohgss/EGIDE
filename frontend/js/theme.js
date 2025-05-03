import { DOM } from './dom-elements.js';

const THEME_KEY = 'theme';
const DEFAULT_THEME = 'light';

export function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
    setTheme(savedTheme);
}

export function setTheme(theme) {
    if (!DOM.body) {
        console.error("[setTheme] Elemento DOM.body não está definido. Certifique-se de que DOM.initialize() foi chamado.");
        return;
    }
    DOM.body.classList.remove('light', 'dark');
    DOM.body.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
}

export function toggleTheme() {
    const currentTheme = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}