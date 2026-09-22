import { useSyncExternalStore } from 'react';
import vietnamese from './locales/vi.json';

export type InterfaceLanguage = 'en' | 'vi';
export const LANGUAGE_KEY = 'storyforge-interface-language';
const listeners = new Set<() => void>();
function readLanguage(): InterfaceLanguage {
  try { return localStorage.getItem(LANGUAGE_KEY) === 'vi' ? 'vi' : 'en'; }
  catch { return 'en'; }
}
let language = readLanguage();
const dictionary: Record<string, string> = vietnamese;
function applyDocumentLanguage() {
  document.documentElement.lang = language;
  document.title = language === 'vi' ? 'StoryForge US · Xưởng sản xuất truyện' : 'StoryForge US · Your stories, in motion';
}
export function setInterfaceLanguage(value: InterfaceLanguage) {
  if (value !== 'en' && value !== 'vi') return;
  language = value;
  try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* Session-only when storage is unavailable. */ }
  applyDocumentLanguage();
  listeners.forEach(listener => listener());
}
export function useInterfaceLanguage() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => language);
}
export function tr(text: string, parameters?: Record<string, string | number>): string {
  const key = text.trim();
  let output = language === 'vi' && Object.hasOwn(dictionary, key)
    ? text.slice(0, text.indexOf(key)) + dictionary[key] + text.slice(text.indexOf(key) + key.length)
    : text;
  if (parameters) output = output.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(parameters, key) ? String(parameters[key]) : match);
  return output;
}
export function translateLabel(value: string): string {
  const english = (value || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return tr(english);
}
if (typeof window !== 'undefined') {
  applyDocumentLanguage();
  window.addEventListener('storage', event => {
    if (event.key === LANGUAGE_KEY || event.key === null) {
      language = readLanguage();
      applyDocumentLanguage();
      listeners.forEach(listener => listener());
    }
  });
}
