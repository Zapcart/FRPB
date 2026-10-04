#!/usr/bin/env bash
#
# FRPB — production deploy / redeploy script (run on the EC2 instance).
#
# Pulls the latest main, installs dependencies, runs Prisma migrations against
# DIRECT_URL, builds the Next.js web app with the production env sourced, then
# zero-downtime reloads the PM2 process.
#
# Usage:
#   cd /var/www/frpb
#   ./deploy/deploy.sh
#
# Assumes:
#   - Repo cloned at /var/www/frpb (override with FRPB_REPO_DIR).
#   - Secrets live in apps/web/.env.production (git-ignored).
#   - PM2 process "frpb-web" is already registered (deploy/ecosystem.config.cjs).
set -euo pipefail

REPO_DIR="${FRPB_REPO_DIR:-/var/www/frpb}"
APP_DIR="${REPO_DIR}/apps/web"
ENV_FILE="${APP_DIR}/.env.production"
BRANCH="${FRPB_DEPLOY_BRANCH:-main}"
PM2_APP="frpb-web"

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[deploy]\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "${REPO_DIR}/.git" ] || die "Repo not found at ${REPO_DIR} (set FRPB_REPO_DIR)."
[ -f "${ENV_FILE}" ] || die "Missing ${ENV_FILE}. Copy deploy/env.production.example and fill in real secrets."

log "Fetching ${BRANCH} in ${REPO_DIR}"
cd "${REPO_DIR}"
git fetch --prune origin
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

# Export every variable from .env.production into this shell so that
# NEXT_PUBLIC_* values are inlined at build time and migrate-deploy.mjs can
# read DATABASE_URL / DIRECT_URL. `set -a` auto-exports each assignment.
log "Loading production environment from ${ENV_FILE}"
set -a
# shellcheck disable=SC1090
. "${ENV_FILE}"
set +a

log "Installing dependencies (frozen lockfile)"
corepack pnpm install --frozen-lockfile

log "Building @frpb/web (includes prisma generate + migrate deploy)"
corepack pnpm --filter @frpb/web build

if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
  log "Reloading PM2 process ${PM2_APP} (zero-downtime)"
  pm2 reload "${PM2_APP}" --update-env
else
  log "Starting PM2 process ${PM2_APP} for the first time"
  pm2 start "${REPO_DIR}/deploy/ecosystem.config.cjs"
fi

pm2 save

log "Deploy complete. Recent logs:"
pm2 logs "${PM2_APP}" --lines 15 --nostream || true
