#!/usr/bin/env bash
# Build the frontend image for linux/amd64 (server arch) and push to ghcr.io.
#
# Usage:
#   ./scripts/build-and-push.sh              # uses NEXT_PUBLIC_* from .env.prod
#   ./scripts/build-and-push.sh --tag v1.2   # tag as :v1.2 in addition to :latest
#
# Prerequisites (one-time):
#   - docker running
#   - gh auth login  (scope write:packages is included)
#   - QEMU for amd64 cross-build on Apple Silicon:
#       docker run --rm --privileged tonistiigi/binfmt --install amd64
#
# NEXT_PUBLIC_* values are inlined into the bundle at build time, so they must
# be present as build args. This script reads them from .env.prod in the repo
# root (the same file used on the server).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="ghcr.io/grigoriy-grisha/zakupki-frontend"
ENV_FILE="${REPO_ROOT}/.env.prod"

cd "${REPO_ROOT}"

# --- preflight ---
if ! docker info >/dev/null 2>&1; then
    echo "✗ Docker daemon is not running. Start Docker Desktop." >&2
    exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
    echo "✗ Not logged in to GitHub. Run: gh auth login" >&2
    exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
    echo "✗ ${ENV_FILE} not found. Create it from .env.prod.example:" >&2
    echo "    cp .env.prod.example .env.prod" >&2
    exit 1
fi

# Read NEXT_PUBLIC_* values from .env.prod (first match wins, strips quotes).
read_env() {
    local key="$1"
    grep -E "^${key}=" "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '"' || true
}

VK_APP_ID="$(read_env NEXT_PUBLIC_VK_APP_ID)"
VK_REDIRECT="$(read_env NEXT_PUBLIC_VK_REDIRECT_URL)"
TG_BOT_ID="$(read_env NEXT_PUBLIC_TELEGRAM_BOT_ID)"
BOT_USERNAME="$(read_env NEXT_PUBLIC_BOT_USERNAME)"

echo "Build args:"
echo "  NEXT_PUBLIC_VK_APP_ID=${VK_APP_ID:-<empty>}"
echo "  NEXT_PUBLIC_VK_REDIRECT_URL=${VK_REDIRECT:-<empty>}"
echo "  NEXT_PUBLIC_TELEGRAM_BOT_ID=${TG_BOT_ID:-<empty>}"
echo "  NEXT_PUBLIC_BOT_USERNAME=${BOT_USERNAME:-<empty>}"
echo ""

# --- docker login to ghcr.io (idempotent) ---
echo "→ Logging in to ghcr.io..."
echo "$(gh auth token)" | docker login ghcr.io -u grigoriy-grisha --password-stdin 2>/dev/null

# --- resolve build tags ---
TAGS=(-t "${IMAGE}:latest")
if [ "${1:-}" = "--tag" ] && [ -n "${2:-}" ]; then
    TAGS+=(-t "${IMAGE}:${2}")
fi

# --- cross-build for amd64 + push ---
echo "→ Building linux/amd64 (QEMU cross-build on Apple Silicon)..."
BUILD_ARGS=(
    --platform linux/amd64
    -f apps/frontend/Dockerfile
    --build-arg "NEXT_PUBLIC_VK_APP_ID=${VK_APP_ID}"
    --build-arg "NEXT_PUBLIC_VK_REDIRECT_URL=${VK_REDIRECT}"
    --build-arg "NEXT_PUBLIC_TELEGRAM_BOT_ID=${TG_BOT_ID}"
    --build-arg "NEXT_PUBLIC_BOT_USERNAME=${BOT_USERNAME}"
    --push
    "${TAGS[@]}"
)

docker buildx build "${BUILD_ARGS[@]}" .

echo ""
echo "✓ Pushed: ${IMAGE}:latest"
echo "  On the server:"
echo "    docker compose -f docker-compose.prod.yml --env-file .env.prod pull frontend"
echo "    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps frontend"
