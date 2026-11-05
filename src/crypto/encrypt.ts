/**
 * SilentProof — client-side encryption (browser, WebCrypto only)
 *
 * Flow:
 *   1. Generate a fresh AES-GCM-256 key for this submission
 *   2. Encrypt the report text (+ optional file) with it
 *   3. Wrap the AES key to the TEE's P-256 ECDH public key:
 *        ephemeral ECDH -> HKDF-SHA256 (info "silentproof-key-wrap") -> AES-KW
 *   4. Upload the ciphertext blob to IPFS (Pinata)
 *   5. Return the CID and the SHA-256 of the payout address (both go onchain)
 *
 * The plaintext and the raw AES key never leave the browser. Only the TEE,
 * holding the matching P-256 private key, can unwrap the AES key.
 *
 * The bundle format is shared with tee/crypto.ts; change both together.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  /** IPFS CID of the encrypted blob */
  ipfsCid: string
  /** Hex SHA-256 of the payout address (stored onchain) */
  payoutAddressHash: string
  /** Base64 JSON key file for the submitter to download */
  keyFile: string
}

export interface EncryptedPayload {
  /** JSON string that gets uploaded to IPFS */
  payloadJson: string
  payoutAddressHash: string
  keyFile: string
}

const WRAP_INFO = 'silentproof-key-wrap'

// ─── Byte helpers ─────────────────────────────────────────────────────────────

function newBytes(length: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(length))
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = newBytes(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

// ─── Hashing ──────────────────────────────────────────────────────────────────

export async function hashPayoutAddress(address: string): Promise<string> {
  const data = new TextEncoder().encode(address.trim().toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(digest))
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return bytesToHex(new Uint8Array(digest))
}

// ─── TEE public key ───────────────────────────────────────────────────────────

/** The TEE's P-256 ECDH public key, 65-byte uncompressed point, hex. */
function configuredTeeKey(): string {
  const key = (import.meta.env.VITE_TEE_PUBLIC_KEY as string | undefined) ?? ''
  return key.trim()
}

function assertTeeKey(hex: string): void {
  if (!/^04[0-9a-fA-F]{128}$/.test(hex)) {
    throw new Error(
      'TEE encryption key is not configured. Set VITE_TEE_PUBLIC_KEY to the key printed by `bun run tee:keygen`.',
    )
  }
}

// ─── Core: encrypt + wrap ─────────────────────────────────────────────────────

async function wrapKeyToTee(aesKey: CryptoKey, teePublicKeyHex: string): Promise<Uint8Array> {
  const teePublic = await crypto.subtle.importKey(
    'raw',
    hexToBytes(teePublicKeyHex),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: teePublic },
    ephemeral.privateKey,
    256,
  )

  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  const wrappingKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(new ArrayBuffer(0)),
      info: new TextEncoder().encode(WRAP_INFO),
    },
    hkdfKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey'],
  )

  const wrapped = new Uint8Array(await crypto.subtle.wrapKey('raw', aesKey, wrappingKey, 'AES-KW'))
  const ephemeralPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))

  // Bundle: ephemeral public key (65 bytes) || wrapped AES key (40 bytes)
  const bundle = newBytes(ephemeralPublic.length + wrapped.length)
  bundle.set(ephemeralPublic, 0)
  bundle.set(wrapped, ephemeralPublic.length)
  return bundle
}

/**
 * Encrypt a report and build the JSON blob that is uploaded to IPFS.
 * Pure crypto, no network. Exported so it can be tested against the TEE side.
 */
export async function buildEncryptedPayload(
  reportText: string,
  payoutAddress: string,
  fileBytes: Uint8Array | undefined,
  teePublicKeyHex: string,
): Promise<EncryptedPayload> {
  assertTeeKey(teePublicKeyHex)

  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])

  const iv = crypto.getRandomValues(newBytes(12))
  const plaintext = JSON.stringify({
    text: reportText,
    file: fileBytes ? toBase64(fileBytes) : null,
    timestamp: Date.now(),
  })
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext)),
  )

  const wrappedKey = await wrapKeyToTee(aesKey, teePublicKeyHex)
  const payoutAddressHash = await hashPayoutAddress(payoutAddress)

  const payloadJson = JSON.stringify({
    version: 1,
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    wrappedKey: toBase64(wrappedKey),
    // The payout address is never in the blob; only its hash goes onchain.
  })

  // Key file: the only copy of the raw key, for the submitter to keep.
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey))
  const keyFile = btoa(
    JSON.stringify({
      version: 1,
      note: 'Keep this file private. It is the only way to prove or decrypt your report later.',
      payoutAddress,
      payoutAddressHash,
      aesKey: toBase64(rawKey),
      iv: toBase64(iv),
      createdAt: new Date().toISOString(),
    }),
  )

  return { payloadJson, payoutAddressHash, keyFile }
}

// ─── IPFS upload (Pinata v3 Files API) ────────────────────────────────────────

async function uploadToIpfs(payloadJson: string): Promise<string> {
  const jwt = (import.meta.env.VITE_PINATA_JWT as string | undefined)?.trim()
  if (!jwt) {
    throw new Error(
      'IPFS upload is not configured. Set VITE_PINATA_JWT to a Pinata API key with Files: Write only.',
    )
  }

  const form = new FormData()
  form.append('file', new Blob([payloadJson], { type: 'application/json' }), 'report.enc.json')
  // Public network so the scorer can fetch the (encrypted) blob from any IPFS gateway
  form.append('network', 'public')

  const response = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  })
  if (!response.ok) {
    throw new Error(`IPFS upload failed (${response.status})`)
  }
  const body = (await response.json()) as { data?: { cid?: string } }
  const cid = body.data?.cid
  if (!cid) throw new Error('IPFS upload returned no CID')
  return cid
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Encrypt a report and upload it to IPFS.
 * Nothing in this function sends plaintext or the raw key anywhere.
 */
export async function encryptAndUpload(
  reportText: string,
  payoutAddress: string,
  fileBytes?: Uint8Array,
): Promise<UploadResult> {
  const built = await buildEncryptedPayload(reportText, payoutAddress, fileBytes, configuredTeeKey())
  const ipfsCid = await uploadToIpfs(built.payloadJson)
  return { ipfsCid, payoutAddressHash: built.payoutAddressHash, keyFile: built.keyFile }
}

/** Trigger a browser download of the submitter's key file. */
export function downloadKeyFile(keyFileBase64: string, ipfsCid: string): void {
  const blob = new Blob([atob(keyFileBase64)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `silentproof-key-${ipfsCid.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
