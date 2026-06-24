import { net, session } from 'electron'

/**
 * Electron's net.fetch routes through Chromium networking, so it honors the
 * proxy configured on the default session (Node's global fetch does not). All
 * outbound HTTP (marketplace, cloud sync) goes through this so one proxy setting
 * covers everything; electron-updater already uses Electron net.
 */
export function httpFetch(input: string | URL, init?: Parameters<typeof net.fetch>[1]) {
  return net.fetch(input.toString(), init)
}

/**
 * Apply the proxy setting to the default session.
 *  - '' / 'system' → follow the OS proxy
 *  - 'direct'      → no proxy
 *  - otherwise     → fixed rules, e.g. 'http://127.0.0.1:7890', 'socks5://host:port'
 */
export function applyProxy(proxy: string): void {
  const s = session.defaultSession
  const p = (proxy || '').trim()
  if (!p || p === 'system') void s.setProxy({ mode: 'system' })
  else if (p === 'direct') void s.setProxy({ mode: 'direct' })
  else void s.setProxy({ proxyRules: p })
}
