# SilentProof — GitHub Codespaces Deploy Guide

Everything in this guide runs on GitHub's servers.
Zero data cost on your device — just a browser tab.

---

## Opening the Codespace

1. Go to https://github.com/Abbagigo13/silentproof
2. Click the green **Code** button
3. Click the **Codespaces** tab
4. Click **Create codespace on main**

GitHub will build the environment (takes about 3-5 minutes the first time).
Rust, cargo-near, near-cli, Python deps, and bun all install automatically.

---

## Step 1 — Log in to NEAR testnet

In the Codespace terminal:

```bash
near login
```

This opens a browser tab pointing to MyNearWallet testnet.
Authorize it. Your keys are saved to `~/.near-credentials/testnet/`.

If you don't have a testnet account yet:
- Go to https://wallet.testnet.near.org
- Create a new account (e.g. `silentproof.testnet`)
- Come back and run `near login`

---

## Step 2 — Get testnet NEAR for gas

Your testnet account needs a small amount of NEAR for gas fees.

```bash
# Check your balance
near state <your-account>.testnet --networkId testnet
```

If your balance is 0, get free testnet NEAR from the faucet:
- Go to https://near-faucet.io or https://wallet.testnet.near.org
- Request testnet NEAR (it's free, no real money)

---

## Step 3 — Deploy the contract

```bash
bash contracts/near/silentproof/deploy.sh <your-account>.testnet
```

This does three things:
1. Compiles the Rust contract to WASM with `cargo-near build`
2. Deploys the WASM to your NEAR testnet account
3. Calls `new` to initialize the contract

Expected output:
```
Building contract...
✓ Contract compiled: contracts/near/silentproof/target/wasm32-unknown-unknown/release/silentproof.wasm
Deploying to <your-account>.testnet...
✓ Deployed in transaction: <tx-hash>
Initializing contract...
✓ Contract initialized
Contract deployed at: <your-account>.testnet
```

---

## Step 4 — Set your env vars

Open the `.env` file in the Codespace editor and set:

```
VITE_NEAR_CONTRACT_ADDRESS=<your-account>.testnet
VITE_NEAR_NETWORK=testnet
```

Then push the change (do NOT commit `.env` — it is gitignored):

```bash
# The .env is gitignored — set it in Arc Studio's .env file instead
# Copy the contract address and paste it into Arc Studio
```

In Arc Studio, open the terminal and run:
```bash
printf 'VITE_NEAR_CONTRACT_ADDRESS=<your-account>.testnet\n' >> /home/user/app/.env
```

---

## Step 5 — Start the TEE scorer (optional for demo)

The TEE scorer handles AI scoring of reports. For the hackathon demo you can
run it locally inside the Codespace:

```bash
cd tee
python scorer.py
```

On startup it prints its ECDSA public key:
```
TEE scorer ready
Public key (hex): 04abcd...
```

Copy that hex value and set it in Arc Studio's `.env`:
```
VITE_TEE_PUBLIC_KEY=04abcd...
```

Then re-run the deploy script with the TEE key:
```bash
near call <your-account>.testnet register_tee_key \
  '{"tee_public_key_hex": "04abcd..."}' \
  --accountId <your-account>.testnet \
  --networkId testnet
```

---

## Step 6 — Run the frontend

Back in Arc Studio (or in the Codespace on port 5173):

```bash
bun run dev
```

The Vite preview auto-forwards on port 5173.

---

## Step 7 — Smoke test the full flow

Follow these steps to confirm everything works end to end:

**Org side:**
1. Open the app, switch to **Organization** mode (top-right toggle)
2. Connect your NEAR testnet wallet
3. Click **Post New Bounty**
4. Fill in title, category, tiers, pool amount, expiry
5. Click **Create Bounty** — approve in wallet
6. Confirm the bounty appears in the marketplace

**Submitter side:**
1. Switch back to **Submitter** mode
2. Click **Submit a Report** on your bounty
3. Type a report (at least 20 characters)
4. Enter any testnet or EVM address as payout address
5. Click **Submit Anonymously**
6. Confirm the IPFS CID appears on the receipt screen
7. Download your encryption key file

**TEE scoring:**
1. The scorer (running in Codespace) picks up the report from NEAR
2. After ~30 seconds, refresh the Org dashboard
3. The report should appear in the queue with a severity tier

**Org confirm:**
1. In Organization mode, find the report in the queue
2. Click **Confirm Payout**
3. Approve in wallet
4. USDC releases to the submitter's address

If all 4 steps complete, the app is working end to end.

---

## Troubleshooting

**`near login` doesn't open a browser tab**
Run `near login` and manually copy the URL it prints into your browser.

**`cargo-near build` fails with "linker not found"**
```bash
sudo apt-get install -y build-essential
```

**Contract deploy fails with "account does not exist"**
Make sure you ran `near login` first and the account name matches exactly.

**`bun: command not found`**
```bash
source ~/.bashrc
```

**IPFS upload fails**
This is expected without a web3.storage API key. The app falls back to a mock CID for the demo — the contract call still goes through.

---

## Codespace resource usage

GitHub Free gives you **120 core-hours/month** of Codespaces.
This project uses a 2-core machine = 60 hours of wall-clock time per month.
That is more than enough for the hackathon build period.

Stop the Codespace when you're done to save your allowance:
- Click the **...** menu next to your Codespace
- Click **Stop codespace**
