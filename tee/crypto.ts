/**
 * SilentProof — TEE-side crypto
 *
 * Two independent keys, because no single curve fits both jobs:
 *   - P-256 ECDH key: browsers can encrypt to it with WebCrypto (decrypts reports)
 *   - secp256k1 key: NEAR's ecrecover host function verifies it (signs scores)
 *
 * The wrap format must match src/crypto/encrypt.ts exactly:
 *   bundle = ephemeralPublicKey(65 bytes) || AES-KW(wrappedKey, 40 bytes)
 *   wrapKey = HKDF-SHA256(ECDH secret, salt = empty, info = "silentproof-key-wrap")
 */

import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'

const WRAP_INFO = 'silentproof-key-wrap'

// ─── Byte helpers ─────────────────────────────────────────────────────────────

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) throw new Error('Invalid hex')
  const out = new Uint8Array(new ArrayBuffer(clean.length / 2))
  for (let i = 0; i < clean.length; i += 2) out[i / 2] = parseInt(clean.slice(i, i + 2), 16)
  return out
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export interface TeeKeys {
  /** P-256 ECDH private key as JWK (decrypts reports) */
  encPrivateJwk: JsonWebKey
  /** P-256 public key, 65-byte uncompressed, hex. Goes in VITE_TEE_PUBLIC_KEY. */
  encPublicHex: string
  /** secp256k1 private key, 32 bytes hex (signs scores) */
  signPrivateHex: string
  /** secp256k1 public key, 65-byte uncompressed, hex. Goes in register_tee_key. */
  signPublicHex: string
}

export async function generateKeys(): Promise<TeeKeys> {
  const enc = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const encPrivateJwk = await crypto.subtle.exportKey('jwk', enc.privateKey)
  const encPublicHex = bytesToHex(new Uint8Array(await crypto.subtle.exportKey('raw', enc.publicKey)))

  const signPrivate = secp256k1.utils.randomSecretKey()
  const signPublic = secp256k1.getPublicKey(signPrivate, false)

  return {
    encPrivateJwk,
    encPublicHex,
    signPrivateHex: bytesToHex(signPrivate),
    signPublicHex: bytesToHex(signPublic),
  }
}

// ─── Decryption ───────────────────────────────────────────────────────────────

export interface EncryptedBlob {
  version?: number
  ciphertext: string
  iv: string
  wrappedKey: string
}

export interface DecryptedReport {
  text: string
  file: string | null
  timestamp: number
}

export async function decryptBlob(blob: EncryptedBlob, encPrivateJwk: JsonWebKey): Promise<DecryptedReport> {
  const bundle = fromBase64(blob.wrappedKey)
  if (bundle.length !== 65 + 40) throw new Error(`Unexpected key bundle length ${bundle.length}`)

  const ephemeralPublic = await crypto.subtle.importKey(
    'raw',
    bundle.slice(0, 65),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    encPrivateJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )

  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemeralPublic }, privateKey, 256)
  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  const unwrappingKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(new ArrayBuffer(0)),
      info: new TextEncoder().encode(WRAP_INFO),
    },
    hkdfKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['unwrapKey'],
  )

  const aesKey = await crypto.subtle.unwrapKey(
    'raw',
    bundle.slice(65),
    unwrappingKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.iv) },
    aesKey,
    fromBase64(blob.ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as DecryptedReport
}

// ─── Score signing ────────────────────────────────────────────────────────────

export type Tier = 'Critical' | 'High' | 'Medium'

const TIER_BYTE: Record<Tier, number> = { Critical: 0, High: 1, Medium: 2 }

/**
 * Digest the contract verifies (see record_tee_score in lib.rs):
 *   keccak256( report_id u64 LE || tier u8 || score u8 || summary_hash 32 bytes )
 */
export function scoreDigest(reportId: number, tier: Tier, score: number, summaryHashHex: string): Uint8Array {
  const summary = hexToBytes(summaryHashHex)
  if (summary.length !== 32) throw new Error('summary hash must be 32 bytes (64 hex chars)')
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('score must be an integer 0-100')

  const payload = new Uint8Array(8 + 1 + 1 + 32)
  new DataView(payload.buffer).setBigUint64(0, BigInt(reportId), true)
  payload[8] = TIER_BYTE[tier]
  payload[9] = score
  payload.set(summary, 10)
  return keccak_256(payload)
}

/**
 * Sign a score. Returns 65 bytes as hex: r(32) || s(32) || v(1), v in {0,1}.
 * Low-S is enforced because the contract calls ecrecover with the malleability flag set.
 */
export function signScore(
  reportId: number,
  tier: Tier,
  score: number,
  summaryHashHex: string,
  signPrivateHex: string,
): string {
  const digest = scoreDigest(reportId, tier, score, summaryHashHex)
  // noble 'recovered' format: recovery byte first, then r || s
  const recovered = secp256k1.sign(digest, hexToBytes(signPrivateHex), {
    prehash: false,
    lowS: true,
    format: 'recovered',
  })
  const recovery = recovered[0]
  const rs = recovered.slice(1)
  const out = new Uint8Array(65)
  out.set(rs, 0)
  out[64] = recovery
  return bytesToHex(out)
}

/** Recover the signer's uncompressed public key from a contract-format signature. */
export function recoverSigner(
  reportId: number,
  tier: Tier,
  score: number,
  summaryHashHex: string,
  signatureHex: string,
): string {
  const sig = hexToBytes(signatureHex)
  const recoveredFormat = new Uint8Array(65)
  recoveredFormat[0] = sig[64]
  recoveredFormat.set(sig.slice(0, 64), 1)
  const digest = scoreDigest(reportId, tier, score, summaryHashHex)
  const compressed = secp256k1.recoverPublicKey(recoveredFormat, digest, { prehash: false })
  // recoverPublicKey returns a compressed point; the contract stores the uncompressed form
  return bytesToHex(secp256k1.Point.fromBytes(compressed).toBytes(false))
}

export function keccak256Hex(data: Uint8Array): string {
  return bytesToHex(keccak_256(data))
}
