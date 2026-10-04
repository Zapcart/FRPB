#!/usr/bin/env bash
#
# FRPB — AWS EC2 bootstrap (Ubuntu 24.04 LTS, Free Tier).
#
# Installs and configures everything the FRPB web app needs on a fresh instance:
#   swap (OOM guard) · Node.js 20.x · Corepack + pnpm · PM2 · Nginx · Certbot · UFW.
#
# Also stops/disables any local PostgreSQL service: Supabase Postgres is the
# authoritative datastore, so a co-located Postgres only wastes RAM on small
# instances (t3.micro/t3.small). See plans/performance-optimization.md § 3.5.
#
# Usage (as root):
#   sudo bash deploy/bootstrap-ec2.sh
#
# Idempotent: safe to re-run. Does NOT touch application secrets or the database.
set -euo pipefail

NODE_MAJOR="20"
PNPM_VERSION="9.9.0"
APP_DIR="/var/www"
LOG_DIR="/var/log/frpb"
SWAP_SIZE="2G"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  die "Run as root (sudo bash deploy/bootstrap-ec2.sh)."
fi

# ── 1. Base packages ──────────────────────────────────────────────────────────
log "[1/9] apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git nginx certbot python3-certbot-nginx ufw

# ── 2. Swap (prevents OOM during `next build` on 1 GB instances) ──────────────
log "[2/9] swap file (${SWAP_SIZE})"
if [ ! -f /swapfile ]; then
  fallocate -l "${SWAP_SIZE}" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  cp /etc/fstab /etc/fstab.bak
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  warn "/swapfile already present — skipping creation"
fi
sysctl vm.swappiness=10
grep -q '^vm.swappiness=' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

# ── 3. Node.js 20.x (NodeSource) ──────────────────────────────────────────────
log "[3/9] Node.js ${NODE_MAJOR}.x via NodeSource"
current_major="$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1 || true)"
if [ -z "${current_major}" ] || [ "${current_major}" -lt "${NODE_MAJOR}" ]; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
else
  warn "Node.js >= ${NODE_MAJOR} already installed — skipping"
fi
node -v

# ── 4. pnpm via Corepack ──────────────────────────────────────────────────────
log "[4/9] pnpm@${PNPM_VERSION} via Corepack"
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate
pnpm -v

# ── 5. PM2 ────────────────────────────────────────────────────────────────────
log "[5/9] PM2 (global)"
npm install -g pm2
pm2 -v

# ── 6. Firewall ───────────────────────────────────────────────────────────────
log "[6/9] UFW (allow OpenSSH + Nginx Full)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 7. Local PostgreSQL (stop + disable — Supabase is the datastore) ──────────
# This is the single largest RAM win on 1 GB instances. Idempotent: if the unit
# is absent we simply warn. The app never talks to a local Postgres (it uses the
# Supabase pooler via DATABASE_URL / DIRECT_URL).
log "[7/9] stop + disable local PostgreSQL (Supabase is authoritative)"
if command -v systemctl >/dev/null 2>&1 \
  && systemctl list-unit-files --type=service 2>/dev/null | grep -q '^postgresql'; then
  systemctl stop 'postgresql.service' 2>/dev/null || true
  systemctl disable 'postgresql.service' 2>/dev/null || true
  warn "local PostgreSQL stopped + disabled — RAM reclaimed for the web app"
else
  warn "no local PostgreSQL service found — skipping (expected on app-only boxes)"
fi

# ── 8. Directories ────────────────────────────────────────────────────────────
log "[8/9] app + log directories"
mkdir -p "${APP_DIR}" "${LOG_DIR}"
chown -R ubuntu:ubuntu "${APP_DIR}" "${LOG_DIR}"

# ── 9. Done ───────────────────────────────────────────────────────────────────
log "[9/9] bootstrap complete"
cat <<'EOF'
Next steps:
  1. Log out and back in so the 'ubuntu' user picks up group changes.
  2. Clone the repo:   git clone https://github.com/Zapcart/FRPB.git /var/www/frpb
  3. Create secrets:   cp deploy/env.production.example apps/web/.env.production && chmod 600 ...
  4. Build + start:    bash deploy/deploy.sh
  5. Nginx + SSL:      see deploy/README.md (§ Nginx, § Certbot)
  6. pm2 startup + pm2 save (see deploy/README.md § PM2)
EOF
