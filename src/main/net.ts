import { net } from 'electron'

/**
 * Electron's net.fetch routes through Chromium networking, so it honors the
 * proxy configured on the default session (Node's global fetch does not). All
 * outbound HTTP (marketplace, cloud sync) goes through this and follows the OS
 * proxy; electron-updater already uses Electron net.
 */
export function httpFetch(input: string | URL, init?: Parameters<typeof net.fetch>[1]) {
  return net.fetch(input.toString(), init)
}
