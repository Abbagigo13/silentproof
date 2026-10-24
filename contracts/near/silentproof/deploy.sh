#!/usr/bin/env bash
# SilentProof NEAR contract deploy script
# Usage: bash contracts/near/silentproof/deploy.sh <account-id>
# Example: bash contracts/near/silentproof/deploy.sh silentproof.testnet
#
# Prerequisites:
#   1. Rust + wasm32 target: rustup target add wasm32-unknown-unknown
#   2. cargo-near: cargo install cargo-near
#   3. near-cli: npm install -g near-cli
#   4. Logged in: near login
#   5. Account exists on testnet: https://wallet.testnet.near.org

set -euo pipefail

ACCOUNT_ID="${1:-}"
if [[ -z "$ACCOUNT_ID" ]]; then
  echo "Usage: bash deploy.sh <account-id>"
  echo "Example: bash deploy.sh silentproof.testnet"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT_DIR="$SCRIPT_DIR"

echo "==> Building NEAR contract (release + wasm32)..."
cd "$CONTRACT_DIR"
cargo build --target wasm32-unknown-unknown --release

WASM_PATH="$CONTRACT_DIR/target/wasm32-unknown-unknown/release/silentproof.wasm"
if [[ ! -f "$WASM_PATH" ]]; then
  echo "ERROR: WASM not found at $WASM_PATH"
  exit 1
fi
echo "    Built: $WASM_PATH ($(du -sh "$WASM_PATH" | cut -f1))"

echo "==> Deploying to NEAR testnet as $ACCOUNT_ID..."
near deploy \
  --accountId "$ACCOUNT_ID" \
  --wasmFile "$WASM_PATH"

echo ""
echo "==> Initializing contract..."
near call "$ACCOUNT_ID" new \
  '{}' \
  --accountId "$ACCOUNT_ID"

echo ""
echo "==> Contract deployed and initialized."
echo "    Contract ID: $ACCOUNT_ID"
echo ""
echo "Next steps:"
echo "  1. Copy the contract ID above into your .env:"
echo "     VITE_NEAR_CONTRACT_ADDRESS=$ACCOUNT_ID"
echo ""
echo "  2. Register the TEE public key (after starting tee/scorer.py):"
echo "     near call $ACCOUNT_ID register_tee_key \\"
echo "       '{\"tee_public_key\": \"<YOUR_TEE_ECDSA_PUBKEY_HEX>\"}' \\"
echo "       --accountId $ACCOUNT_ID"
echo ""
echo "  3. Set VITE_TEE_PUBLIC_KEY in .env to the same hex pubkey."
echo ""
echo "  4. Fund the TEE account with testnet NEAR for gas:"
echo "     near send $ACCOUNT_ID <tee-account-id> 1"
echo ""
echo "Done."
