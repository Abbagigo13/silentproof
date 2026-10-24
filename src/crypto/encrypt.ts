/**
 * SilentProof — Client-side Encryption
 *
 * All encryption happens in the browser using the WebCrypto API.
 * No key material ever leaves the browser in plaintext.
 *
 * Flow:
 *   1. Generate a fresh AES-GCM-256 key for this submission
 *   2. Encrypt the report text + attachments with that key
 *   3. Encrypt the AES key to the TEE's ECDH public key
 *   4. Upload the ciphertext blob to IPFS
 *   5. Return: { ipfsCid, encryptedKey, payoutAddressHash }
 *
 * The IPFS CID and the encrypted key blob go on-chain.
 * The plaintext never touches any server.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EncryptedReport {
  /** AES-GCM ciphertext as base64 */
  ciphertext: string
  /** AES-GCM IV (12 bytes) as base64 */
  iv: string
  /** AES-256 key wrapped to TEE's ECDH public key, base64 */
  wrappedKey: string
  /** SHA-256 hash of the payout address (hex) — stored on-chain */
  payoutAddressHash: string
  /** The raw AES-GCM CryptoKey — kept in memory for the key download */
  rawKey: CryptoKey
}

export interface UploadResult {
  /** IPFS CID of the encrypted blob */
  ipfsCid: string
  /** Hex-encoded SHA-256 of the payout address */
  payoutAddressHash: string
  /** Base64-encoded JSON key file for the submitter to download */
  keyFile: string
}

// ─── TEE public key (ECDH P-256) ─────────────────────────────────────────────
// In production this is fetched from the NEAR contract (get_contract_info)
// and verified against the TEE attestation report.
// For testnet demo we use a fixed development key.
const TEE_PUBLIC_KEY_HEX =
  '0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base64Encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── SHA-256 hash of the payout address ──────────────────────────────────────

export async function hashPayoutAddress(address: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(address.trim().toLowerCase())
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(hashBuf))
}

// ─── Generate a fresh AES-GCM-256 key ────────────────────────────────────────

async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — needed for key export
    ['encrypt', 'decrypt']
  )
}

// ─── Encrypt report text (+ optional file bytes) with AES-GCM ────────────────

async function encryptReport(
  reportText: string,
  fileBytes: Uint8Array | null,
  aesKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder()

  // Build payload: JSON with text + optional file (base64)
  const payload = JSON.stringify({
    text: reportText,
    file: fileBytes ? base64Encode(fileBytes.buffer as ArrayBuffer) : null,
    timestamp: Date.now(),
  })

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(payload)
  )

  return {
    ciphertext: base64Encode(ciphertext),
    iv: base64Encode(iv.buffer),
  }
}

// ─── Wrap AES key to TEE's ECDH public key ────────────────────────────────────
// Uses ECDH key agreement + AES-KW to wrap the report key.
// Only the TEE's private key can unwrap it.

async function wrapKeyToTee(aesKey: CryptoKey): Promise<string> {
  // Import TEE's ECDH public key (uncompressed P-256 point)
  const teeKeyBytes = hexToBytes(TEE_PUBLIC_KEY_HEX)

  const teePublicKey = await crypto.subtle.importKey(
    'raw',
    teeKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // Generate an ephemeral ECDH key pair for this submission
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  )

  // Derive a shared wrapping key via ECDH
  const wrappingKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: teePublicKey },
    ephemeral.privateKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey']
  )

  // Wrap the AES report key
  const wrappedKey = await crypto.subtle.wrapKey('raw', aesKey, wrappingKey, 'AES-KW')

  // Export ephemeral public key so the TEE can reproduce the ECDH shared secret
  const ephemeralPubRaw = await crypto.subtle.exportKey('raw', ephemeral.publicKey)

  // Bundle: ephemeral_pub (65 bytes) || wrapped_key (40 bytes for 256-bit AES-KW)
  const bundle = new Uint8Array(ephemeralPubRaw.byteLength + wrappedKey.byteLength)
  bundle.set(new Uint8Array(ephemeralPubRaw), 0)
  bundle.set(new Uint8Array(wrappedKey), ephemeralPubRaw.byteLength)

  return base64Encode(bundle.buffer)
}

// ─── Upload to IPFS via web3.storage ─────────────────────────────────────────

async function uploadToIpfs(blob: Blob): Promise<string> {
  // Uses the public IPFS HTTP API via web3.storage free tier
  // In production replace with a dedicated endpoint
  const formData = new FormData()
  formData.append('file', blob, 'report.enc')

  const response = await fetch('https://api.web3.storage/upload', {
    method: 'POST',
    headers: {
      // Authorization header added by the caller if a token is available
      // For testnet demo, uses public unauthenticated endpoint
    },
    body: formData,
  })

  if (!response.ok) {
    // Fallback: use IPFS infura gateway
    const infuraResponse = await fetch('https://ipfs.infura.io:5001/api/v0/add', {
      method: 'POST',
      body: formData,
    })
    if (!infuraResponse.ok) throw new Error('IPFS upload failed')
    const infuraData = await infuraResponse.json() as { Hash: string }
    return infuraData.Hash
  }

  const data = await response.json() as { cid: string }
  return data.cid
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Encrypt a report and upload it to IPFS.
 * Returns the IPFS CID, payout address hash, and a key file for download.
 *
 * Nothing in this function sends plaintext to any server.
 */
export async function encryptAndUpload(
  reportText: string,
  payoutAddress: string,
  fileBytes?: Uint8Array
): Promise<UploadResult> {
  // 1. Generate fresh AES-256-GCM key
  const aesKey = await generateAesKey()

  // 2. Encrypt the report
  const { ciphertext, iv } = await encryptReport(reportText, fileBytes ?? null, aesKey)

  // 3. Wrap the AES key to the TEE's public key
  const wrappedKey = await wrapKeyToTee(aesKey)

  // 4. Hash the payout address (this goes on-chain; the plaintext stays off-chain)
  const payoutAddressHash = await hashPayoutAddress(payoutAddress)

  // 5. Build the IPFS payload
  const ipfsPayload = JSON.stringify({
    version: 1,
    ciphertext,
    iv,
    wrappedKey,
    // No payout address here — it's hashed on-chain, provided only at payout time
  })
  const blob = new Blob([ipfsPayload], { type: 'application/json' })

  // 6. Upload to IPFS
  const ipfsCid = await uploadToIpfs(blob)

  // 7. Build the key file for the submitter to download
  // This is the ONLY record of the raw AES key — the submitter must save it
  const rawKeyBytes = await crypto.subtle.exportKey('raw', aesKey)
  const keyFileData = JSON.stringify({
    version: 1,
    note: 'Keep this file safe. It is the only way to decrypt your report if you need to prove its contents.',
    ipfsCid,
    payoutAddress,
    payoutAddressHash,
    aesKey: base64Encode(rawKeyBytes),
    iv,
    createdAt: new Date().toISOString(),
  })

  return {
    ipfsCid,
    payoutAddressHash,
    keyFile: btoa(keyFileData),
  }
}

/**
 * Trigger a browser download of the submitter's key file.
 */
export function downloadKeyFile(keyFileBase64: string, ipfsCid: string): void {
  const content = atob(keyFileBase64)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `silentproof-key-${ipfsCid.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Compute a SHA-256 hash for display purposes (e.g. summary hash in TEE scorer).
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return bytesToHex(new Uint8Array(hashBuf))
}
