# FRPB — AWS EC2 Deployment (PM2 + Nginx + Certbot + CloudFront)

Runnable artifacts for deploying the `frpb/apps/web` Next.js app to an
**Ubuntu 24.04 LTS (Free Tier)** EC2 instance.

> The full narrative runbook (architecture diagram, DNS table, troubleshooting
> matrix, security checklist) lives at [`../plans/aws-ec2-deployment.md`](../plans/aws-ec2-deployment.md).

## Files

| File | Purpose |
| --- | --- |
| [`bootstrap-ec2.sh`](./bootstrap-ec2.sh) | One-time root setup: 2 GB swap, Node 20.x, Corepack/pnpm 9.9.0, global PM2, Nginx, Certbot, UFW, app/log dirs. |
| [`env.production.example`](./env.production.example) | Names-only template for `apps/web/.env.production`. Copy and fill with real secrets (git-ignored). |
| [`ecosystem.config.cjs`](./ecosystem.config.cjs) | PM2 config running `next start` on `127.0.0.1:3000`. |
| [`nginx/frpb.in.conf`](./nginx/frpb.in.conf) | Nginx reverse proxy for `frpb.in` + `www.frpb.in` with proxy/upgrade headers, gzip, static caching. |
| [`deploy.sh`](./deploy.sh) | Redeploy: pull → install → build (+ migrate) → `pm2 reload`. |

## Quick start (on the EC2 host)

```bash
# 0. SSH in (adjust key path / host)
ssh -i ~/.ssh/frpb-key.pem ubuntu@<EC2_PUBLIC_IP>

# 1. Bootstrap the machine (one time, as root)
sudo bash /tmp/bootstrap-ec2.sh   # after copying it up, or clone then run

# 2. Clone the repo
sudo mkdir -p /var/www && sudo chown -R ubuntu:ubuntu /var/www
git clone https://github.com/Zapcart/FRPB.git /var/www/frpb
cd /var/www/frpb

# 3. Configure secrets
cp deploy/env.production.example apps/web/.env.production
nano apps/web/.env.production          # fill in real values

# 4. First build + start under PM2
chmod +x deploy/deploy.sh
./deploy/deploy.sh

# 5. Persist PM2 across reboots
pm2 startup systemd -u ubuntu --hp /home/ubuntu   # run the printed command
pm2 save

# 6. Nginx site + SSL
sudo cp deploy/nginx/frpb.in.conf /etc/nginx/sites-available/frpb.in
sudo ln -s /etc/nginx/sites-available/frpb.in /etc/nginx/sites-enabled/frpb.in
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d frpb.in -d www.frpb.in
```

## Verify

```bash
curl -I http://127.0.0.1:3000            # app is up on loopback
curl -I https://frpb.in                  # TLS + proxy chain
pm2 status                               # frpb-web online
pm2 logs frpb-web --lines 50             # runtime logs
```

## SSH cheat-sheet

```bash
ssh -i ~/.ssh/frpb-key.pem ubuntu@<EC2_PUBLIC_IP>      # connect
pm2 status / pm2 logs frpb-web / pm2 restart frpb-web  # process control
sudo systemctl reload nginx                            # after nginx edits
sudo certbot renew --dry-run                           # test cert renewal
df -h ; free -h                                        # disk / memory
tail -f /var/log/frpb/frpb-web-out.log                 # app stdout
```

## CloudFront (1 TB/month free tier)

Create a distribution with origin `frpb.in` (HTTPS only, port 443):

- **Origin protocol policy:** HTTPS only.
- **Allowed HTTP methods:** `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`.
- **Forward all viewer headers / cookies / query strings** (the app uses
  Supabase auth cookies and Razorpay redirects — use the AWS managed
  **`Managed-AllViewer`** origin request policy, or legacy "Forward all").
- **Viewer protocol policy:** Redirect HTTP to HTTPS.
- **Compress objects automatically:** enabled.
- **Default TTL:** 0; **`/api/*` and `/_next/data/*`:** no caching.
- **`/_next/static/*`:** long TTL (1 year) — content-hashed assets.
- **ACM certificate:** must be in **`us-east-1`** for CloudFront viewer TLS.
- Point the `www.frpb.in` (or apex `frpb.in`) alias / Route 53 record at the
  CloudFront domain if you want CDN-fronted traffic.

> If you front the app with CloudFront, ensure **`NEXT_PUBLIC_APP_URL`** stays
> `https://frpb.in` so canonical URLs / SEO metadata remain stable, and that
> Nginx trusts the `X-Forwarded-*` headers CloudFront sends.

## Right-sizing & RAM checklist (Task 4)

The app targets a **1 GB `t3.micro`** today; Next.js + Node can spike at cold
boot. Work through this list in order.

- **Resize `t3.micro` to `t3.small` (2 GB)** - stop instance, Instance Settings,
  Change Instance Type, start. The **Elastic IP is retained**, so DNS needs no
  change.
- **Interim swap:** `bootstrap-ec2.sh` already creates 2 GB of swap (verify with
  `free -h`). On an older box, add it before resizing:
  `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`.
- **Node 20.x** active (`node -v`) and **only `frpb-web`** under PM2
  (`pm2 list`). A stray second app sharing 1 GB is the usual cause of OOM.
- **Stop the co-tenant Postgres** (Supabase is the datastore), only if nothing
  else on the box needs it:
  `sudo systemctl stop postgresql && sudo systemctl disable postgresql`.
- **Bounded V8 heap** is set: `ecosystem.config.cjs` exports
  `NODE_OPTIONS=--max-old-space-size=384`. Raise it in step with the resize
  (e.g. `768` on `t3.small`) if `pm2 logs` shows heap-pressure restarts.
- **CloudFront** enabled in front of Nginx (see the section above).
- **Remove test/placeholder secrets** from `apps/web/.env.production` and keep
  `chmod 600`. Ensure `ALLOW_DEV_TEST_KEYS` and `MASTER_TEST_LICENSE_KEY` are
  **unset in production** - the master test-key shortcut is now fail-closed
  there (see the template's "Test-key lockdown" section).
