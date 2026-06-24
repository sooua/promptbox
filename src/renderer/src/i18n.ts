import type { Language } from '@shared/types'
import { useStore } from './store'
import { en } from './locales/en'

/**
 * Chinese-as-key i18n. Every user-facing string is written in Chinese and wrapped
 * in t('...'); Chinese mode returns it verbatim, English mode looks it up in the
 * `en` dictionary (falling back to the Chinese so nothing ever renders blank).
 *
 * Interpolation: write {name} placeholders and pass a params object —
 * t('已删除「{title}」', { title }).
 */
export type Params = Record<string, string | number>

export function translate(lang: Language, zh: string, params?: Params): string {
  let s = lang === 'en' ? (en[zh] ?? zh) : zh
  if (params) {
    for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]))
  }
  return s
}

/** Imperative translate for non-component contexts (toasts, confirms). */
export function t(zh: string, params?: Params): string {
  const lang = (useStore.getState().settings?.language ?? 'zh') as Language
  return translate(lang, zh, params)
}

/**
 * Hook returning a `t` bound to the current language. Components that render
 * translated text should use this so they re-render when the language switches.
 */
export function useT(): (zh: string, params?: Params) => string {
  const lang = (useStore((s) => s.settings?.language) ?? 'zh') as Language
  return (zh, params) => translate(lang, zh, params)
}

export function useLang(): Language {
  return (useStore((s) => s.settings?.language) ?? 'zh') as Language
}
