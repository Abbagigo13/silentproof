#!/usr/bin/env bash
# SilentProof — Codespaces post-create setup
# Runs once when the Codespace is first created.
# Everything installs on GitHub's servers — zero data cost for you.

set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   SilentProof — Setting up dev environment  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── 1. Rust + wasm32 target ─────────────────────────────────────────────────
echo "→ Installing Rust..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown
echo "✓ Rust $(rustc --version)"

# ─── 2. cargo-near ───────────────────────────────────────────────────────────
echo "→ Installing cargo-near..."
cargo install cargo-near --locked
echo "✓ cargo-near $(cargo near --version 2>/dev/null || echo 'installed')"

# ─── 3. NEAR CLI ─────────────────────────────────────────────────────────────
echo "→ Installing near-cli..."
npm install -g near-cli@latest
echo "✓ near-cli $(near --version)"

# ─── 4. Python deps for TEE scorer ───────────────────────────────────────────
echo "→ Installing Python dependencies for TEE scorer..."
pip install -r tee/requirements.txt --quiet
echo "✓ Python deps installed"

# ─── 5. Frontend deps ────────────────────────────────────────────────────────
echo "→ Installing frontend dependencies (bun)..."
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
bun install
echo "✓ Frontend deps installed"

# ─── 6. Add paths to shell profile ───────────────────────────────────────────
{
  echo 'source "$HOME/.cargo/env"'
  echo 'export BUN_INSTALL="$HOME/.bun"'
  echo 'export PATH="$BUN_INSTALL/bin:$PATH"'
  echo 'export NEAR_ENV=testnet'
} >> "$HOME/.bashrc"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Setup complete! Next steps:               ║"
echo "║   1. Read .devcontainer/README-codespaces.md║"
echo "║   2. Run: near login                        ║"
echo "║   3. Run: bash contracts/near/silentproof/  ║"
echo "║           deploy.sh <your-account>.testnet  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
