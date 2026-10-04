# FRPB — AWS EC2 Production Deployment Runbook

Deploy the `frpb` monorepo web app (`apps/web`, Next.js 14 App Router) onto a single
**AWS EC2 Ubuntu 24.04 LTS (Free Tier)** instance with **PM2**, **Nginx**, **Certbot (Let's Encrypt
SSL)** and an **AWS CloudFront** CDN in front of it.

- **Repository:** `https://github.com/Zapcart/FRPB.git` (branch: `main`)
- **Public domain:** `frpb.in` + `www.frpb.in`
- **Expected public origin:** `https://frpb.in`
- **App runtime:** `next start` on `http://127.0.0.1:3000` (managed by PM2)

> **Critical build facts (verified from the repo)**
> 1. `apps/web/next.config.mjs` has **no `output: "standalone"`**. Do **not** look for a
>    `.next/standalone/server.js`; PM2 must run `next start`.
> 2. The web build is a chain: `pnpm --filter @frpb/shared build && prisma generate &&
>    node scripts/migrate-deploy.mjs && next build` (see `apps/web/package.json`).
> 3. `NEXT_PUBLIC_*` variables are **inlined at build time** — they must exist in the
>    environment **before** `next build`, or the browser bundle ships empty values.
> 4. The pre-build steps read `process.env` directly, so the production env file must be
>    **exported into the shell** before invoking the build.
> 5. Node `>=20`, pnpm `>=9` via Corepack (`packageManager: pnpm@9.9.0`).

---

## 0. Target architecture

```mermaid
flowchart LR
  U[User Browser] --> CF[CloudFront Distribution]
  CF -->|HTTPS 443| NGINX[Nginx on EC2]
  NGINX -->|proxy 127.0.0.1:3000| PM2[PM2 process - next start]
  PM2 --> DB[(Supabase Postgres)]
  PM2 --> REDIS[(Upstash Redis)]
  PM2 --> RAZORPAY[Razorpay API]
  CERT[Certbot - Let's Encrypt] --> NGINX
```

- **Viewer TLS:** CloudFront uses an **ACM certificate** (must be issued in **us-east-1**).
- **Origin TLS:** CloudFront → Nginx uses the **Let's Encrypt** certificate on the instance
  (or an ACM cert on the origin domain). Both hops are HTTPS.
- Only **80** and **443** are exposed by the EC2 Security Group. Port **3000 stays private**.

---

## 1. Prerequisites (do these in the AWS Console first)

| Item | Value |
| --- | --- |
| AMI | Ubuntu Server 24.04 LTS (HVM, SSD) |
| Instance type | `t3.micro` (or `t2.micro`) — Free Tier eligible |
| Storage | 20–30 GB gp3 (Free Tier allows up to 30 GB) |
| Key pair | `.pem` SSH key downloaded |
| Security Group inbound | `22` (your IP), `80` (0.0.0.0/0), `443` (0.0.0.0/0) |
| Elastic IP | **Recommended** — allocate + associate so the origin IP is stable |

**DNS (at your registrar / Route 53):**

| Type | Name | Value |
| --- | --- | --- |
| A | `frpb.in` | EC2 Elastic IP |
| A | `www.frpb.in` | EC2 Elastic IP |

> **Free Tier memory caveat:** `t3.micro`/`t2.micro` have 1 GB RAM. `next build` can OOM.
> Step 2 creates a **2 GB swap file** to prevent build crashes.

---

## 2. Connect & provision the server

```bash
# From your local machine (replace the path + IP)
chmod 400 ~/Downloads/frpb-key.pem
ssh -i ~/Downloads/frpb-key.pem ubuntu@<ELASTIC_IP>
```

### 2.1 One-shot bootstrap script

Save as `~/bootstrap-ec2.sh` and run with `sudo bash ~/bootstrap-ec2.sh`.

```bash
#!/usr/bin/env bash
# FRPB — EC2 bootstrap: swap, system packages, Node 20, pnpm, PM2, Nginx, Certbot.
# Idempotent — safe to re-run.
set -euo pipefail

echo "==> [1/7] apt update + base packages"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git nginx certbot python3-certbot-nginx ufw

echo "==> [2/7] 2 GB swap (prevents OOM during next build on 1 GB instances)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  cp /etc/fstab /etc/fstab.bak
  echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
else
  echo "swapfile already present — skipping"
fi
sysctl vm.swappiness=10
echo 'vm.swappiness=10' | tee -a /etc/sysctl.conf

echo "==> [3/7] Node.js 20.x via NodeSource"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi
node -v

echo "==> [4/7] pnpm via Corepack"
corepack enable
corepack prepare pnpm@9.9.0 --activate
pnpm -v

echo "==> [5/7] PM2 (global)"
npm install -g pm2
pm2 -v

echo "==> [6/7] firewall (UFW)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> [7/7] app + log directories"
mkdir -p /var/www /var/log/frpb
chown -R ubuntu:ubuntu /var/www /var/log/frpb

echo "Bootstrap complete. Log out and back in so the ubuntu user picks up group changes."
```

---

## 3. Clone the repository & install dependencies

```bash
# As user 'ubuntu'
cd /var/www
git clone https://github.com/Zapcart/FRPB.git frpb
cd frpb
```

> **Private-repo auth:** if the clone prompts, use a **GitHub Personal Access Token** or a
> deploy key. Never commit credentials. For a read-only deploy key:
> `ssh-keygen -t ed25519 -C "ec2-deploy"` → add the public key to GitHub → clone via
> `git@github.com:Zapcart/FRPB.git`.

```bash
# Enable pnpm for this shell (Corepack), then install the whole workspace
corepack enable
corepack pnpm install --frozen-lockfile
```

---

## 4. Production environment file

Create **`/var/www/frpb/apps/web/.env.production`** (never commit this file). It is read by both
the **build** (for `NEXT_PUBLIC_*` inlining) and the **runtime**.

```dotenv
# ── Canonical origin (drives sitemap.ts + metadata) ──────────────
NEXT_PUBLIC_APP_URL=https://frpb.in
NODE_ENV=production
PORT=3000

# ── Database (Supabase Postgres / Prisma) ────────────────────────
# Pooled connection for the app, direct connection for migrations.
DATABASE_URL="postgresql://USER:PASSWORD@POOLER_HOST:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://USER:PASSWORD@DB_HOST:5432/postgres"

# ── Supabase Auth ────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# ── Upstash Redis (rate limiting / lockout) ──────────────────────
UPSTASH_REDIS_REST_URL=https://YOUR-DB.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_TOKEN

# ── Razorpay (payments) ──────────────────────────────────────────
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# ── Analytics / email ────────────────────────────────────────────
NEXT_PUBLIC_POSTHOG_KEY=phc_XXXXXXXXXXXX
NEXT_PUBLIC_POSTHOG_HOST=https://frpb.in/ingest
RESEND_API_KEY=re_XXXXXXXXXXXX
ANALYTICS_HASH_SALT=generate-a-random-32-char-string

# ── Optional: skip prisma migrate during build (CI-only) ─────────
# SKIP_PRISMA_MIGRATE=1
```

Lock it down:

```bash
chmod 600 /var/www/frpb/apps/web/.env.production
```

> Generate a salt with: `openssl rand -hex 24`
> `DIRECT_URL` is required by `prisma migrate deploy`; `DATABASE_URL` (pooled) is used at runtime.
> If the DB is unreachable at build time, set `SKIP_PRISMA_MIGRATE=1` and run migrations
> separately (see §6).

---

## 5. Production build

```bash
cd /var/www/frpb

# 1. Export the production env into the shell so pre-build steps see it
set -a
source apps/web/.env.production
set +a

# 2. Build shared package + Prisma client + run migrations + build Next
corepack pnpm --filter @frpb/shared build
corepack pnpm --filter @frpb/web exec prisma generate
corepack pnpm --filter @frpb/web exec node scripts/migrate-deploy.mjs
corepack pnpm --filter @frpb/web exec next build
```

**Single-command alternative** (runs the exact same chain via the package script):

```bash
set -a; source apps/web/.env.production; set +a
corepack pnpm --filter @frpb/web build
```

**Turbo alternative** (from the repo root):

```bash
set -a; source apps/web/.env.production; set +a
corepack pnpm build:web   # → turbo run build --filter=@frpb/web
```

Verify the build produced the expected static output:

```bash
ls -1 apps/web/.next/BUILD_ID
test -d apps/web/.next/server && echo "build OK"
```

---

## 6. PM2 process manager

Create **`/var/www/frpb/ecosystem.config.cjs`**:

```js
// FRPB — PM2 process definition for the Next.js web app.
// Runs `next start` (no standalone output in next.config.mjs).
module.exports = {
  apps: [
    {
      name: "frpb-web",
      cwd: "/var/www/frpb/apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/var/log/frpb/web-error.log",
      out_file: "/var/log/frpb/web-out.log",
    },
  ],
};
```

Start, verify, and enable boot persistence:

```bash
cd /var/www/frpb
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs frpb-web --lines 40        # confirm "Ready on http://localhost:3000"

# Verify the origin directly (must return HTTP 200)
curl -I http://127.0.0.1:3000

# Persist across reboots
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# ↑ run the exact 'sudo env ...' command it prints, then:
pm2 save
```

Useful PM2 operations:

```bash
pm2 restart frpb-web
pm2 reload frpb-web
pm2 stop frpb-web
pm2 delete frpb-web
pm2 monit
pm2 logs frpb-web --lines 100
```

> **Secrets:** runtime env vars are loaded by Next.js from `apps/web/.env.production`
> automatically on `next start`, so they are intentionally **not** duplicated in the PM2 config.

---

## 7. Nginx reverse proxy

Create **`/etc/nginx/sites-available/frpb.in`**:

```nginx
# FRPB — reverse proxy to the PM2-managed Next.js server (127.0.0.1:3000).
# HTTP is only used to serve the ACME challenge and redirect to HTTPS.

upstream frpb_web {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name frpb.in www.frpb.in;

    # Let's Encrypt HTTP-01 challenge + permanent redirect to HTTPS.
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name frpb.in www.frpb.in;

    # ── Certbot-managed certificates (populated in §8) ────────────
    ssl_certificate     /etc/letsencrypt/live/frpb.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/frpb.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ── Security headers ──────────────────────────────────────────
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ── Gzip (Next also compresses; this covers proxied assets) ───
    gzip on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript
               application/x-javascript text/xml application/xml image/svg+xml;

    client_max_body_size 5m;

    # ── Immutable Next.js build assets ────────────────────────────
    location /_next/static/ {
        proxy_pass http://frpb_web;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # ── Everything else → Next.js ─────────────────────────────────
    location / {
        proxy_pass http://frpb_web;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";

        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

> **Certbot ordering:** the `ssl_certificate` lines point at files that do not exist until §8.
> Follow §8's two-pass flow (temporary HTTP-only block → certbot → full block), or run
> `certbot --nginx` which edits this file automatically.

Enable the site and reload:

```bash
sudo ln -s /etc/nginx/sites-available/frpb.in /etc/nginx/sites-enabled/frpb.in
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. SSL with Certbot (Let's Encrypt)

Ensure DNS A records for `frpb.in` and `www.frpb.in` already resolve to the Elastic IP, then:

```bash
sudo certbot --nginx \
  -d frpb.in \
  -d www.frpb.in \
  --redirect \
  --agree-tos \
  -m admin@frpb.in \
  --no-eff-email
```

Certbot will:
1. complete the HTTP-01 challenge over port 80,
2. write certificates to `/etc/letsencrypt/live/frpb.in/`,
3. patch the Nginx server block to add the 443 server and HTTP→HTTPS redirect,
4. reload Nginx.

Verify auto-renewal (Certbot installs a systemd timer by default):

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

> **CloudFront note:** CloudFront cannot use a Let's Encrypt cert for the **viewer**
> connection. Issue a **separate ACM certificate in `us-east-1`** for the CloudFront
> distribution (see §10). The Let's Encrypt cert secures only the **Nginx/origin** hop.

---

## 9. Post-deploy verification

```bash
# Origin (direct)
curl -I http://127.0.0.1:3000

# Through Nginx locally
curl -I -H "Host: frpb.in" http://127.0.0.1

# Public HTTPS
curl -I https://frpb.in
curl -I https://www.frpb.in

# SEO surfaces produced by the programmatic build
curl -s https://frpb.in/sitemap.xml | head -40
curl -s https://frpb.in/robots.txt
curl -sI https://frpb.in/tools
```

Expected: `HTTP/2 200`, `strict-transport-security` present, `/sitemap.xml` lists the
`/tools`, brand hubs and model spokes.

---

## 10. AWS CloudFront distribution (1 TB/month Free Tier)

CloudFront's AWS Free Tier includes **1 TB data transfer out + 10,000,000 HTTP/HTTPS requests
per month** (12 months). Use it as the CDN/edge in front of the EC2 origin.

### 10.1 Create an ACM certificate (viewer TLS)

- Region: **us-east-1 (N. Virginia)** — required for CloudFront.
- Request a **public** certificate for `frpb.in` **and** `www.frpb.in`
  (add both as SANs, or use `*.frpb.in`).
- Validate via **DNS** (add the CNAME records ACM provides to your DNS).
- Wait for status **Issued**.

### 10.2 Distribution settings

| Setting | Value |
| --- | --- |
| **Origin domain** | `frpb.in` (your Elastic IP's DNS, or the domain) |
| **Origin protocol policy** | **HTTPS only** (origin has Let's Encrypt) |
| **Origin path** | *(leave empty)* |
| **Minimum origin SSL protocol** | TLSv1.2 |
| **Viewer protocol policy** | **Redirect HTTP to HTTPS** |
| **Allowed HTTP methods** | `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE` (checkout/webhooks need POST) |
| **Cache policy (default `/*`)** | Managed **CachingOptimized** (or a custom one that honours the origin `Cache-Control`) |
| **Origin request policy (default)** | Managed **AllViewer** (forwards `Host`, cookies, headers — required for Supabase auth cookies) |
| **Compress objects automatically** | **Yes** |
| **Alternate domain names (CNAMEs)** | `frpb.in`, `www.frpb.in` |
| **Custom SSL certificate** | The ACM cert from §10.1 |
| **Security policy** | TLSv1.2_2021 |
| **Supported HTTP versions** | HTTP/2 and HTTP/3 |
| **Price class** | Use only North America & Europe (or All — still within Free Tier at low volume) |
| **Default root object** | *(empty — Next serves `/`)* |
| **WAF** | optional |

### 10.3 Behaviors

| Path pattern | Origin | Purpose |
| --- | --- | --- |
| `/_next/static/*` | EC2 origin | Immutable hashed build assets — cache aggressively (CachingOptimized, long TTL) |
| `/downloads/*` | EC2 origin | Installer binaries (`application/octet-stream`) — cache with long TTL |
| `/api/*` | EC2 origin | **Disable caching** (CachingDisabled) + AllViewer — dynamic (auth, checkout, webhooks) |
| `/ingest/*` | EC2 origin | PostHog first-party proxy — forward all, minimal cache |
| `/*` (default, last) | EC2 origin | SSR pages — CachingOptimized + AllViewer |

> Order matters: CloudFront evaluates the **first matching** behavior, so put the specific
> paths (`/_next/static/*`, `/api/*`, `/downloads/*`, `/ingest/*`) **above** the `/*` default.

### 10.4 Point DNS at CloudFront

After the distribution is **Deployed**, update DNS so the apex/www resolve to CloudFront:

| Type | Name | Value |
| --- | --- | --- |
| A (alias) or CNAME | `frpb.in` | CloudFront distribution domain, e.g. `d111111abcdef8.cloudfront.net` |
| A (alias) or CNAME | `www.frpb.in` | same distribution domain |

**Important — origin loop warning:** if `frpb.in` points to CloudFront **and** the CloudFront
origin is also `frpb.in`, you get a request loop. Resolve it by using the **Elastic IP's public
DNS name** (e.g. `ec2-x-x-x-x.<region>.compute.amazonaws.com`) as the CloudFront **Origin
domain**, and expand the origin's `Host` header to keep `frpb.in` for the app. Keep the EC2
Security Group allowing CloudFront IPs on 443 (the default `0.0.0.0/0` on 443 covers this).

---

## 11. Redeploy / update workflow

```bash
cd /var/www/frpb
git pull origin main

# Re-export env before every build (NEXT_PUBLIC_* inlining + migrate)
set -a; source apps/web/.env.production; set +a

corepack pnpm install --frozen-lockfile
corepack pnpm --filter @frpb/web build      # shared + prisma + migrate + next build

pm2 reload frpb-web
pm2 save
```

Optional **zero-downtime:** run two PM2 instances in `cluster` mode only if you later add
`output: "standalone"`; with `next start` keep a single `fork` instance (or delete + start).

---

## 12. SSH terminal cheat-sheet

```bash
# ── Connect ─────────────────────────────────────────────────────
chmod 400 frpb-key.pem
ssh -i frpb-key.pem ubuntu@<ELASTIC_IP>

# ── App ─────────────────────────────────────────────────────────
cd /var/www/frpb
pm2 status
pm2 logs frpb-web --lines 100
pm2 restart frpb-web
pm2 reload frpb-web
pm2 monit

# ── Build & deploy ──────────────────────────────────────────────
set -a; source apps/web/.env.production; set +a
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @frpb/web build
pm2 reload frpb-web && pm2 save

# ── Nginx ───────────────────────────────────────────────────────
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# ── SSL ─────────────────────────────────────────────────────────
sudo certbot --nginx -d frpb.in -d www.frpb.in
sudo certbot renew --dry-run
sudo certbot certificates

# ── System health ───────────────────────────────────────────────
df -h && free -h
htop
sudo journalctl -u nginx -n 50
sudo journalctl -u pm2-ubuntu -n 50

# ── Local probes ────────────────────────────────────────────────
curl -I http://127.0.0.1:3000
curl -I -H "Host: frpb.in" http://127.0.0.1
curl -I https://frpb.in
curl -s https://frpb.in/sitemap.xml | head
```

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `next build` killed / OOM | 1 GB RAM with no swap | Ensure the 2 GB swap from §2.1 is active (`free -h`) |
| `Database schema is out of date` | Migrations not applied | `corepack pnpm --filter @frpb/web exec node scripts/migrate-deploy.mjs` with `DIRECT_URL` set |
| Browser bundle has empty `NEXT_PUBLIC_*` | Built without env exported | `set -a; source apps/web/.env.production; set +a` **before** `next build`; rebuild |
| `502 Bad Gateway` from Nginx | PM2 app down / not on 3000 | `pm2 status`, `pm2 logs frpb-web`, `curl -I http://127.0.0.1:3000` |
| Auth cookies dropped | CloudFront not forwarding cookies | Set Origin request policy to **AllViewer** |
| Redirect loop via CloudFront | Origin = same domain pointing at CloudFront | Use the Elastic IP public DNS as the origin domain |
| Certbot renewal fails | Port 80 blocked / DNS changed | Re-open 80, confirm A records, `sudo certbot renew --force-renewal` |
| PM2 not restarting on reboot | `pm2 startup` not run / not saved | Re-run `pm2 startup`, run printed sudo command, then `pm2 save` |

---

## 14. Security hardening checklist

- [ ] `.env.production` is `chmod 600` and **never** committed.
- [ ] Only ports `22`, `80`, `443` open in the Security Group; `3000` stays private.
- [ ] UFW enabled (`ufw status`).
- [ ] `fail2ban` installed and jailing SSH (optional but recommended).
- [ ] SSH password auth disabled (`PasswordAuthentication no` in `/etc/ssh/sshd_config`).
- [ ] `unattended-upgrades` enabled for security patches.
- [ ] Certbot auto-renew timer active (`systemctl list-timers | grep certbot`).
- [ ] Razorpay webhook endpoint reachable over HTTPS and its secret set.
- [ ] CloudFront `/api/*` behavior set to **no caching**.
