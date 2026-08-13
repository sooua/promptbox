import { describe, expect, it } from 'vitest'
import { decryptPayload, encryptPayload, isEncrypted } from './crypto'

describe('sync crypto', () => {
  it('round-trips a payload', () => {
    const plain = JSON.stringify({ prompts: [{ title: '中文标题', content: 'a {{v}}' }] })
    const raw = encryptPayload(plain, 'hunter2')
    expect(isEncrypted(raw)).toBe(true)
    expect(raw).not.toContain('中文标题')
    expect(decryptPayload(raw, 'hunter2')).toBe(plain)
  })

  it('rejects a wrong passphrase rather than returning garbage', () => {
    const raw = encryptPayload('secret', 'right')
    expect(() => decryptPayload(raw, 'wrong')).toThrow()
  })

  it('rejects tampered ciphertext (GCM auth)', () => {
    const w = JSON.parse(encryptPayload('secret', 'k'))
    const flipped = Buffer.from(w.data, 'base64')
    flipped[0] ^= 0xff
    w.data = flipped.toString('base64')
    expect(() => decryptPayload(JSON.stringify(w), 'k')).toThrow()
  })

  it('does not treat a plaintext envelope mentioning the marker as encrypted', () => {
    // A prompt documenting this very format would previously poison every sync:
    // isEncrypted() matched on a substring and decode then threw "已加密".
    const plain = JSON.stringify({
      prompts: [{ title: '同步格式说明', content: 'the wrapper key is "promptbox_enc"' }]
    })
    expect(isEncrypted(plain)).toBe(false)
  })

  it('treats non-JSON and partial wrappers as plaintext', () => {
    expect(isEncrypted('not json at all')).toBe(false)
    expect(isEncrypted(JSON.stringify({ promptbox_enc: 1 }))).toBe(false)
  })
})
