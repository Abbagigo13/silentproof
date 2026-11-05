/**
 * Cross-check: encrypt with the real browser module (src/crypto/encrypt.ts),
 * decrypt with the TEE module, then sign and recover a score.
 *
 * Run: bun test tee/crypto.test.ts
 */
import { describe, expect, test } from 'bun:test'
import { buildEncryptedPayload } from '../src/crypto/encrypt'
import {
  bytesToHex,
  decryptBlob,
  generateKeys,
  keccak256Hex,
  recoverSigner,
  signScore,
  type EncryptedBlob,
} from './crypto'

describe('browser -> TEE encryption', () => {
  test('TEE decrypts what the browser encrypted', async () => {
    const keys = await generateKeys()
    const text = 'Vendor X invoiced $250,000 for services never delivered in Q3.'
    const file = new Uint8Array([1, 2, 3, 4, 5])

    const built = await buildEncryptedPayload(text, 'Alice.testnet', file, keys.encPublicHex)
    const blob = JSON.parse(built.payloadJson) as EncryptedBlob
    const report = await decryptBlob(blob, keys.encPrivateJwk)

    expect(report.text).toBe(text)
    expect(report.file).toBe(btoa(String.fromCharCode(...file)))
  })

  test('a different TEE key cannot decrypt', async () => {
    const real = await generateKeys()
    const other = await generateKeys()
    const built = await buildEncryptedPayload('secret', 'bob.testnet', undefined, real.encPublicHex)
    const blob = JSON.parse(built.payloadJson) as EncryptedBlob
    await expect(decryptBlob(blob, other.encPrivateJwk)).rejects.toThrow()
  })

  test('payload never contains plaintext or the payout address', async () => {
    const keys = await generateKeys()
    const built = await buildEncryptedPayload('very secret words', 'carol.testnet', undefined, keys.encPublicHex)
    expect(built.payloadJson).not.toContain('very secret words')
    expect(built.payloadJson).not.toContain('carol')
  })

  test('payout hash matches the contract rule (sha256 of lowercase address)', async () => {
    const keys = await generateKeys()
    const built = await buildEncryptedPayload('x'.repeat(30), 'Dave.TestNet', undefined, keys.encPublicHex)
    const expected = new Bun.CryptoHasher('sha256').update('dave.testnet').digest('hex')
    expect(built.payoutAddressHash).toBe(expected)
  })
})

describe('score signing', () => {
  test('keccak256 matches the known empty-input vector', () => {
    expect(keccak256Hex(new Uint8Array(0))).toBe(
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    )
  })

  test('signature recovers to the registered key for both recovery ids', async () => {
    const keys = await generateKeys()
    const summaryHash = '11'.repeat(32)
    const seen = new Set<number>()

    for (let id = 0; id < 40; id++) {
      const sig = signScore(id, 'High', 80, summaryHash, keys.signPrivateHex)
      expect(sig.length).toBe(130)
      const v = parseInt(sig.slice(128), 16)
      expect([0, 1]).toContain(v)
      seen.add(v)
      expect(recoverSigner(id, 'High', 80, summaryHash, sig)).toBe(keys.signPublicHex)
    }
    // Over 40 signatures we should have seen both recovery ids (not a hardcoded v)
    expect(seen.size).toBe(2)
  })

  test('low-S is enforced (contract uses the malleability flag)', async () => {
    const keys = await generateKeys()
    const halfN = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n
    for (let id = 0; id < 30; id++) {
      const sig = signScore(id, 'Critical', 90, '22'.repeat(32), keys.signPrivateHex)
      const s = BigInt('0x' + sig.slice(64, 128))
      expect(s <= halfN).toBe(true)
    }
  })

  test('a tampered score does not recover to the signer', async () => {
    const keys = await generateKeys()
    const sig = signScore(1, 'Medium', 50, '33'.repeat(32), keys.signPrivateHex)
    let recovered: string | null = null
    try {
      recovered = recoverSigner(1, 'Critical', 50, '33'.repeat(32), sig)
    } catch {
      recovered = null
    }
    expect(recovered).not.toBe(keys.signPublicHex)
  })

  test('public keys are 65-byte uncompressed points', async () => {
    const keys = await generateKeys()
    expect(keys.encPublicHex).toMatch(/^04[0-9a-f]{128}$/)
    expect(keys.signPublicHex).toMatch(/^04[0-9a-f]{128}$/)
    expect(bytesToHex(new Uint8Array(1))).toBe('00')
  })
})
