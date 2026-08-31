#!/usr/bin/env bash
# Build the frontend image ON THE SERVER (native linux/amd64, no emulation)
# and push it to ghcr.io.
#
# Why not build locally on macOS (Apple Silicon)?
#   QEMU cross-build segfaults on `next build` (Turbopack native binary).
#   Rosetta hangs on the same step. The server is native amd64, so building
#   there is both faster and reliable. Swap (4 GB) covers the RAM peak.
#
# Usage:
#   ./scripts/build-and-push.sh              # build + push :latest + redeploy
#   ./scripts/build-and-push.sh --tag v1.2   # also tag as :v1.2
#   ./scripts/build-and-push.sh --no-deploy  # build + push only, skip redeploy
#
# Prerequisites:
#   - sshpass installed (brew install hudochenkov/sshpass/sshpass)
#   - SSH credentials below (or set SERVER_HOST / SERVER_USER / SERVER_PASS env)
#   - gh auth login on the server (for ghcr push) — or set GHCR_PUSH_TOKEN

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="ghcr.io/grigoriy-grisha/zakupki-frontend"
SERVER_HOST="${SERVER_HOST:-62.109.0.90}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASS="${SERVER_PASS:-}"
SERVER_REPO_DIR="/root/zakupki"

cd "${REPO_ROOT}"

# --- preflight ---
if [ -z "${SERVER_PASS}" ]; then
    echo "✗ SERVER_PASS not set. Export it or hardcode in the script." >&2
    echo "  export SERVER_PASS='your-password'" >&2
    exit 1
fi
export SSHPASS="${SERVER_PASS}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new
          -o PreferredAuthentications=password
          -o PubkeyAuthentication=no
          -o ServerAliveInterval=15
          -o ServerAliveCountMax=120)
SCP_OPTS=("${SSH_OPTS[@]}")

echo "→ Syncing local code to server (git)..."
sshpass -e ssh "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_HOST}" \
    "cd ${SERVER_REPO_DIR} && git fetch origin && git checkout ${GIT_BRANCH:-authorization-admin} && git pull origin ${GIT_BRANCH:-authorization-admin}" 2>&1 | tail -5

echo ""
echo "→ Building linux/amd64 on server (native, ~5 min with swap)..."
sshpass -e ssh "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_HOST}" bash -s <<'REMOTE_BUILD' 2>&1 | tail -25
set -euo pipefail
cd /root/zakupki
set -a; source .env.prod; set +a

# Push the NEXT_PUBLIC_* (and anything else) to build args + tag for ghcr.
docker build \
    -f apps/frontend/Dockerfile \
    --build-arg "NEXT_PUBLIC_VK_APP_ID=${NEXT_PUBLIC_VK_APP_ID}" \
    --build-arg "NEXT_PUBLIC_VK_REDIRECT_URL=${NEXT_PUBLIC_VK_REDIRECT_URL}" \
    --build-arg "NEXT_PUBLIC_TELEGRAM_BOT_ID=${NEXT_PUBLIC_TELEGRAM_BOT_ID}" \
    --build-arg "NEXT_PUBLIC_BOT_USERNAME=${NEXT_PUBLIC_BOT_USERNAME}" \
    -t ghcr.io/grigoriy-grisha/zakupki-frontend:latest \
    . 2>&1 | tail -15
echo "BUILD_EXIT=$?"
REMOTE_BUILD

echo ""
echo "→ Pushing image to ghcr.io..."
sshpass -e ssh "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_HOST}" \
    "docker push ${IMAGE}:latest" 2>&1 | tail -6

# Optional redeploy
if [ "${1:-}" != "--no-deploy" ]; then
    echo ""
    echo "→ Redeploying frontend container..."
    sshpass -e ssh "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_HOST}" \
        "cd ${SERVER_REPO_DIR} && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate --no-deps frontend" 2>&1 | tail -4
fi

echo ""
echo "✓ Done. Image: ${IMAGE}:latest"
[ "${1:-}" != "--no-deploy" ] && echo "  Frontend redeployed."
