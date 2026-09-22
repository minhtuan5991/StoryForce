import { translateLabel } from './i18n';
export type Row = Record<string, any>;
let csrf = '';
export async function api<T = any>(path: string, method = 'GET', body?: any): Promise<T> {
  if (!csrf && method !== 'GET') csrf = (await (await fetch('/api/session')).json()).token;
  const isForm = body instanceof FormData;
  const response = await fetch('/api' + path, {method, headers: {
    ...(method !== 'GET' ? {'X-StoryForge-Token': csrf} : {}),
    ...(body !== undefined && !isForm ? {'Content-Type':'application/json'} : {})
  }, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)});
  if (!response.ok) {
    const error = await response.json().catch(() => ({detail: response.statusText}));
    throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
  }
  return response.json();
}
export function navigate(path: string) { window.location.hash = path; }
export function downloadText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], {type:'text/plain;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function time(seconds: number) { return `${Math.floor((seconds || 0)/60)}:${String(Math.floor((seconds || 0)%60)).padStart(2,'0')}`; }
export function pretty(value: any) { return JSON.stringify(value, null, 2); }
export function label(value: string) { return translateLabel(value); }
