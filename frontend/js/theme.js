// theme.js - Lógica de troca de tema

import { DOM } from './dom-elements.js';

const THEME_STORAGE_KEY = "theme";
const DARK_THEME_CLASS = "dark-theme";

export function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  setTheme(savedTheme === "dark");
}

export function toggleTheme() {
  const isCurrentlyDark = DOM.body.classList.contains(DARK_THEME_CLASS);
  setTheme(!isCurrentlyDark);
}

function setTheme(isDark) {
  DOM.body.classList.toggle(DARK_THEME_CLASS, isDark);
  if (DOM.themeToggle) {
      DOM.themeToggle.textContent = isDark ? "☀️" : "🌙";
  }
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
}