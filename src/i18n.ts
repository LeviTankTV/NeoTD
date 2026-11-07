export type Lang = 'ru' | 'en';

export interface Localized {
  ru: string;
  en: string;
}

export const L = (ru: string, en: string): Localized => ({ ru, en });

let current: Lang = 'ru';
const listeners = new Set<() => void>();

const RU_ATTR = 'ru';
const EN_ATTR = 'en';

export function getLang(): Lang {
  return current;
}

export function tr(value: Localized | string | undefined | null): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[current] ?? value.ru;
}

export function tf(value: Localized, vars: Record<string, string | number>): string {
  return tr(value).replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function setLang(lang: Lang, persist = true): void {
  if (current === lang) {
    applyStatic();
    listeners.forEach((listener) => listener());
    return;
  }
  current = lang;
  document.documentElement.lang = lang;
  applyStatic();
  listeners.forEach((listener) => listener());
  if (persist) saveLang(lang);
}

export function onLangChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initLang(fallback: Lang = 'ru'): Lang {
  const stored = readLang();
  const lang = stored ?? fallback;
  current = lang;
  document.documentElement.lang = lang;
  applyStatic();
  return lang;
}

function readLang(): Lang | null {
  try {
    const value = localStorage.getItem('neotd.lang');
    return value === 'en' || value === 'ru' ? value : null;
  } catch {
    return null;
  }
}

function saveLang(lang: Lang): void {
  try {
    localStorage.setItem('neotd.lang', lang);
  } catch {
    /* storage can be disabled — language still applies for the session */
  }
}

function originalText(node: HTMLElement): string {
  if (!(RU_ATTR in node.dataset)) node.dataset.ru = node.textContent ?? '';
  return node.dataset.ru ?? '';
}

export function applyStatic(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-en]').forEach((node) => {
    const ru = originalText(node);
    node.textContent = current === 'en' ? node.dataset.en ?? ru : ru;
  });

  root.querySelectorAll<HTMLElement>('[data-en-title]').forEach((node) => {
    if (!('ruTitle' in node.dataset)) node.dataset.ruTitle = node.getAttribute('title') ?? '';
    node.setAttribute('title', current === 'en' ? node.dataset.enTitle ?? '' : node.dataset.ruTitle ?? '');
  });

  root.querySelectorAll<HTMLElement>('[data-en-aria]').forEach((node) => {
    if (!('ruAria' in node.dataset)) node.dataset.ruAria = node.getAttribute('aria-label') ?? '';
    node.setAttribute(
      'aria-label',
      current === 'en' ? node.dataset.enAria ?? '' : node.dataset.ruAria ?? '',
    );
  });

  root.querySelectorAll<HTMLInputElement>('[data-en-placeholder]').forEach((node) => {
    if (!('ruPlaceholder' in node.dataset)) node.dataset.ruPlaceholder = node.placeholder ?? '';
    node.placeholder =
      current === 'en' ? node.dataset.enPlaceholder ?? '' : node.dataset.ruPlaceholder ?? '';
  });
}

export function langLabel(lang: Lang): string {
  return lang === 'ru' ? 'RU' : 'EN';
}

void EN_ATTR;
