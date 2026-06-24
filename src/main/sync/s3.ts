import { createHash, createHmac } from 'crypto'
import type { S3ConfigInput, SyncVersion } from '@shared/types'
import type { ConnectionResult, SyncProvider } from './provider'

const FILE = 'promptbox-data.json'
const HISTORY_PREFIX = 'history/'
const MAX_HISTORY = 30
const SERVICE = 's3'
const EMPTY_HASH = createHash('sha256').update('').digest('hex')

function sha256hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}
function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}
function signingKey(secret: string, date: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), SERVICE), 'aws4_request')
}
/** AWS-flavored URI encoding (encodeURIComponent + the extra reserved chars). */
function enc(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function normPrefix(prefix?: string): string {
  if (!prefix) return ''
  return prefix.replace(/^\/+/, '').replace(/\/*$/, '/')
}

/**
 * Issue a SigV4-signed request against a path-style S3 endpoint
 * (`${endpoint}/${bucket}/${key}`), which is the most compatible across
 * AWS S3, MinIO, Cloudflare R2, Backblaze B2, etc.
 */
async function s3Fetch(
  cfg: S3ConfigInput,
  method: string,
  key: string,
  query: Record<string, string>,
  body?: string
): Promise<Response> {
  const endpoint = cfg.endpoint.replace(/\/+$/, '')
  const url = new URL(`${endpoint}/${cfg.bucket}/${key}`)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)

  const host = url.host
  const amzdate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '') // YYYYMMDDTHHMMSSZ
  const datestamp = amzdate.slice(0, 8)
  const payloadHash = body !== undefined ? sha256hex(body) : EMPTY_HASH

  const canonicalUri = url.pathname
  const canonicalQuery = [...url.searchParams.entries()]
    .map(([k, v]) => [enc(k), enc(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzdate}\n`
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')

  const scope = `${datestamp}/${cfg.region}/${SERVICE}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzdate,
    scope,
    sha256hex(canonicalRequest)
  ].join('\n')
  const signature = hmac(signingKey(cfg.secretAccessKey, datestamp, cfg.region), stringToSign).toString('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return fetch(url.toString(), {
    method,
    headers: {
      Authorization: authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzdate,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body
  })
}

export async function testS3(cfg: S3ConfigInput): Promise<ConnectionResult> {
  try {
    const res = await s3Fetch(cfg, 'GET', '', { 'list-type': '2', 'max-keys': '1' })
    if (res.status === 403) return { ok: false, error: '认证失败或无权限' }
    if (res.status === 404) return { ok: false, error: 'Bucket 不存在' }
    if (!res.ok) return { ok: false, error: `服务器返回 ${res.status}` }
    return { ok: true, account: cfg.bucket }
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }
}

export class S3Provider implements SyncProvider {
  private prefix: string
  constructor(private cfg: S3ConfigInput) {
    this.prefix = normPrefix(cfg.prefix)
  }

  async pull(): Promise<string | null> {
    const res = await s3Fetch(this.cfg, 'GET', `${this.prefix}${FILE}`, {})
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`拉取失败（${res.status}）`)
    const text = await res.text()
    return text || null
  }

  async push(payload: string): Promise<void> {
    const res = await s3Fetch(this.cfg, 'PUT', `${this.prefix}${FILE}`, {}, payload)
    if (!res.ok) throw new Error(`推送失败（${res.status}）`)
    try {
      await s3Fetch(this.cfg, 'PUT', `${this.prefix}${HISTORY_PREFIX}${Date.now()}.json`, {}, payload)
      await this.prune()
    } catch {
      /* history is non-critical */
    }
  }

  async listVersions(): Promise<SyncVersion[]> {
    const res = await s3Fetch(this.cfg, 'GET', '', {
      'list-type': '2',
      prefix: `${this.prefix}${HISTORY_PREFIX}`
    })
    if (!res.ok) return []
    const xml = await res.text()
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1])
    return keys
      .map((key) => {
        const name = key.split('/').pop() ?? ''
        return { id: key, createdAt: parseInt(name, 10) }
      })
      .filter((v) => Number.isFinite(v.createdAt))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async getVersion(id: string): Promise<string | null> {
    const res = await s3Fetch(this.cfg, 'GET', id, {})
    if (!res.ok) return null
    const text = await res.text()
    return text || null
  }

  private async prune(): Promise<void> {
    const versions = await this.listVersions()
    for (const v of versions.slice(MAX_HISTORY)) {
      await s3Fetch(this.cfg, 'DELETE', v.id, {}).catch(() => {})
    }
  }
}
