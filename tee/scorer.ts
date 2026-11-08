/**
 * SilentProof — scorer CLI (run from the project root)
 *
 *   bun run tee:keygen                    create keys, print what to configure
 *   bun run tee:score -- --report-id 0    score one report
 *   bun run tee:watch                     poll the contract and score new reports
 *   bun run tee:env                       print the secret to give the hosted function
 *   bun run tee:accesskey                 make a restricted key for the hosted function
 *
 * Flags: --dry-run (do not send), --interval <seconds> (watch), --force (keygen)
 *
 * Environment (optional): SILENTPROOF_CONTRACT_ID (default abbagigo.testnet),
 * TEE_ACCOUNT_ID, NEAR_RPC_URL, NEAR_NETWORK, NEAR_AI_API_KEY, TEE_KEYS_PATH.
 *
 * Sending uses the `near` CLI, so the sending account must be logged in.
 * The hosted version (api/score.ts) signs in code instead and needs no CLI.
 *
 * Testnet note: this process is not inside a confidential-compute enclave.
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { KeyPair } from 'near-api-js'
import { generateKeys, type TeeKeys } from './crypto.js'
import {
  DEFAULT_RPC_URLS,
  getReport,
  listUnscored,
  processReport,
  type CoreConfig,
  type SignedScore,
} from './core.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const CONTRACT_ID = process.env.SILENTPROOF_CONTRACT_ID ?? 'abbagigo.testnet'
const TEE_ACCOUNT_ID = process.env.TEE_ACCOUNT_ID ?? CONTRACT_ID
const NETWORK = process.env.NEAR_NETWORK ?? 'testnet'
const KEYS_PATH = process.env.TEE_KEYS_PATH ?? join(HERE, '.keys.json')
const ACCESS_KEY_PATH = join(HERE, '.access-key.json')

const cfg: CoreConfig = {
  contractId: CONTRACT_ID,
  rpcUrls: [...(process.env.NEAR_RPC_URL ? [process.env.NEAR_RPC_URL] : []), ...DEFAULT_RPC_URLS],
  nearAiApiKey: process.env.NEAR_AI_API_KEY,
  nearAiModel: process.env.NEAR_AI_MODEL,
}

const log = (m: string) => console.log(`[scorer] ${m}`)

// ─── Keys ─────────────────────────────────────────────────────────────────────

function loadKeys(): TeeKeys {
  if (!existsSync(KEYS_PATH)) throw new Error(`No keys found at ${KEYS_PATH}. Run: bun run tee:keygen`)
  return JSON.parse(readFileSync(KEYS_PATH, 'utf8')) as TeeKeys
}

function saveSecret(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2), { mode: 0o600 })
  try { chmodSync(path, 0o600) } catch { /* best effort */ }
}

function printKeyInstructions(keys: TeeKeys): void {
  console.log('1) Encryption key for the app. Put this in .env (and in Vercel), then restart/redeploy:')
  console.log(`   VITE_TEE_PUBLIC_KEY=${keys.encPublicHex}\n`)
  console.log('2) Signing key for the contract. Register it once, as the contract owner:')
  console.log(
    `   near call ${CONTRACT_ID} register_tee_key '${JSON.stringify({ public_key_hex: keys.signPublicHex })}' --accountId ${CONTRACT_ID} --networkId ${NETWORK}\n`,
  )
}

async function keygen(force: boolean): Promise<void> {
  if (existsSync(KEYS_PATH) && !force) {
    console.log(`Keys already exist at ${KEYS_PATH} (use --force to replace them).\n`)
    printKeyInstructions(loadKeys())
    return
  }
  const keys = await generateKeys()
  saveSecret(KEYS_PATH, keys)
  console.log(`Created ${KEYS_PATH} (private keys, never commit this file).\n`)
  printKeyInstructions(keys)
}

// ─── Hosted-function setup ────────────────────────────────────────────────────

function printEnv(): void {
  const keys = loadKeys()
  console.log('Add this as an environment variable named TEE_KEYS_JSON on Vercel (it is a secret):\n')
  console.log(`TEE_KEYS_JSON=${JSON.stringify(keys)}\n`)
}

function accessKey(): void {
  if (existsSync(ACCESS_KEY_PATH)) {
    const saved = JSON.parse(readFileSync(ACCESS_KEY_PATH, 'utf8')) as { publicKey: string; secretKey: string }
    printAccessKey(saved.publicKey, saved.secretKey, true)
    return
  }
  const pair = KeyPair.fromRandom('ed25519')
  const publicKey = pair.getPublicKey().toString()
  const secretKey = pair.toString()
  saveSecret(ACCESS_KEY_PATH, { publicKey, secretKey })
  printAccessKey(publicKey, secretKey, false)
}

function printAccessKey(publicKey: string, secretKey: string, existing: boolean): void {
  console.log(existing ? 'Using the access key created earlier.\n' : 'Created a new access key (saved to tee/.access-key.json, gitignored).\n')
  console.log('1) Authorize it on the contract. It can ONLY call record_tee_score, nothing else:')
  console.log(
    `   near add-key ${TEE_ACCOUNT_ID} ${publicKey} --contractId ${CONTRACT_ID} --methodNames record_tee_score --allowance 2 --networkId ${NETWORK}\n`,
  )
  console.log('2) Add these as environment variables on Vercel (the second one is a secret):')
  console.log(`   TEE_NEAR_ACCOUNT_ID=${TEE_ACCOUNT_ID}`)
  console.log(`   TEE_NEAR_PRIVATE_KEY=${secretKey}\n`)
}

// ─── Sending via the near CLI ─────────────────────────────────────────────────

function runCli(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // near-cli reads a custom RPC from NEAR_TESTNET_RPC / NEAR_MAINNET_RPC (it has no --nodeUrl flag)
    const rpcEnv = NETWORK === 'mainnet' ? 'NEAR_MAINNET_RPC' : 'NEAR_TESTNET_RPC'
    const child = spawn('near', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, [rpcEnv]: cfg.rpcUrls[0] },
    })
    let out = ''
    child.stdout.on('data', (d: Buffer) => { out += d.toString() })
    child.stderr.on('data', (d: Buffer) => { out += d.toString() })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve(out)
      else reject(new Error(`near CLI exited with ${code}: ${out.slice(-400)}`))
    })
  })
}

async function sendViaCli(s: SignedScore): Promise<void> {
  const args = {
    report_id: s.reportId,
    tier: s.tier,
    score: s.score,
    summary_hash: s.summaryHash,
    signature_hex: s.signatureHex,
  }
  await runCli([
    'call', CONTRACT_ID, 'record_tee_score', JSON.stringify(args),
    '--accountId', TEE_ACCOUNT_ID,
    '--networkId', NETWORK,
    '--gas', '100000000000000',
  ])
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const flag = (name: string) => process.argv.includes(`--${name}`)

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const command = process.argv[2]
  const dryRun = flag('dry-run')

  if (command === 'keygen') return keygen(flag('force'))
  if (command === 'env') return printEnv()
  if (command === 'accesskey') return accessKey()

  const keys = loadKeys()
  const send = dryRun ? null : sendViaCli
  log(`contract=${CONTRACT_ID} sender=${TEE_ACCOUNT_ID} network=${NETWORK}${dryRun ? ' (dry run)' : ''}`)

  if (command === 'score') {
    const id = Number(option('report-id'))
    if (!Number.isInteger(id) || id < 0) throw new Error('Usage: score --report-id <n>')
    const report = await getReport(cfg, id)
    if (!report) throw new Error(`Report #${id} not found`)
    if (report.tee_tier !== null) throw new Error(`Report #${id} is already scored`)
    return processReport(cfg, report, keys, send, log)
  }

  if (command === 'watch') {
    const intervalMs = Math.max(5, Number(option('interval') ?? 15)) * 1000
    const failed = new Map<number, number>()
    log(`Watching for new reports every ${intervalMs / 1000}s. Ctrl+C to stop.`)
    for (;;) {
      try {
        for (const report of await listUnscored(cfg)) {
          if ((failed.get(report.id) ?? 0) >= 3) continue
          try {
            await processReport(cfg, report, keys, send, log)
            if (dryRun) failed.set(report.id, 3) // do not loop on the same report in a dry run
          } catch (e) {
            failed.set(report.id, (failed.get(report.id) ?? 0) + 1)
            console.error(`[scorer] Report #${report.id} failed: ${e instanceof Error ? e.message : String(e)}`)
          }
        }
      } catch (e) {
        console.error(`[scorer] Poll failed: ${e instanceof Error ? e.message : String(e)}`)
      }
      await new Promise(r => setTimeout(r, intervalMs))
    }
  }

  console.log('Usage: bun run tee:keygen | tee:score -- --report-id <n> | tee:watch | tee:env | tee:accesskey  [--dry-run]')
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
