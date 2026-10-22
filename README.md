# FinTax

Practice ERP for tax consultants in Pakistan. One application with four parts:

| Part | Who uses it | Where |
|---|---|---|
| Website | Visitors, prospective practices | `/` |
| Master admin | You, the FinTax owner | `#/admin` |
| Consultant workspace | Tax practices and their staff | `#/app` |
| Client portal | The practices' clients | `#/portal` |

Everyone signs in on the same page (`#/login`) and lands in the right part for their role.

## What is in it

**Website.** Hero with the live featured deadline, a deadline rail computed from the compliance calendar, "why FinTax" value section, ROI calculator, product tour, two-plan pricing pulled live from the database (yearly by default, monthly anchor, per-day price, founding-seat counter and countdown), a free income tax calculator, FAQ, call-back form, exit-intent reminder, sticky mobile CTA and real sign-up notifications. Every scarcity and social-proof element reads real data: seats left is your seat limit minus actual sign-ups, countdowns use the dates you set, notifications only show genuine new practices, and testimonials stay hidden until you publish real ones.

**Master admin.** Revenue and sign-up dashboard, practices list and detail (activate, renew, extend trial, change plan, set end date, suspend, restore, reset owner password, open as support, delete), payment verification queue, the two-plan editor (prices in PKR, limits, features, website bullets; the website updates immediately), leads, website content editor (hero, announcement bar, offer and urgency, social proof, testimonials, FAQs, contact, logo and brand colour), announcements, support tickets, activity log, settings (how practices pay you, trials, compliance calendar, tax calculator slabs, admin users, password requests, full backup).

**Consultant workspace.** Dashboard with due and overdue work, client CRM (CNIC, NTN, STRN, ATL status, FBR/PRA/SRB/KPRA/BRA registrations, CSV import and export), client files with uploads, document requests, approvals and comment threads, returns and filings board (drag and drop, bulk-create monthly returns), notice tracker (s.114(4), 122(9), 176, 177, Sales Tax Act s.11 and more), tasks, calendar, invoices in PKR with sales tax on services, payments (including proofs clients submit), expenses, messages, reports (fees, receivables aging, workload, profit), encrypted credentials vault, team logins, subscription and payment, practice settings, help and support, Ctrl K search.

**Client portal.** Phone-first home with what needs action, upload by photo or file against each request, approve or request changes on drafts, return progress tracker, invoices with "I have paid" and receipt upload, messages, notices and profile.

**Installable app.** Web app manifest, service worker for the app shell, install button with iPhone, Android and desktop instructions as a fallback. One-tap install needs HTTPS on your own domain.

## Run it

Requirements: Node.js 18 or newer. Node 22.5+ stores data in SQLite; older versions use a JSON file. There are no npm packages to install.

```bash
# start with an empty database
ADMIN_EMAIL=you@yourdomain.pk ADMIN_PASSWORD='choose-a-strong-one' node server/server.js

# or try it with demo practices, clients and invoices
npm run demo        # then sign in as admin@fintax.demo / demo123
```

Open http://localhost:8080. Without `ADMIN_EMAIL`/`ADMIN_PASSWORD`, a random admin password is printed and saved to `data/ADMIN_CREDENTIALS.txt`. Change it after signing in, then delete that file.

Demo logins (with `npm run demo`), all with password `demo123`:

| Role | Email |
|---|---|
| Master admin | admin@fintax.demo |
| Consultant (owner) | consultant@fintax.demo |
| Staff member | staff@fintax.demo |
| Client | client@fintax.demo |

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `FINTAX_DATA` | `./data` | Database, uploads and the encryption key |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | | First master admin |
| `FINTAX_SECRET` | auto | Key for the credentials vault. If unset, a key is generated in the data folder. Keep it safe; losing it makes saved portal passwords unreadable. |
| `SEED_DEMO` | | `1` loads demo data into an empty database |
| `MAX_UPLOAD_MB` | `25` | Largest file a user can upload |
| `SESSION_DAYS` | `30` | How long a sign-in lasts |
| `TRUST_PROXY` | | `1` when running behind Nginx or a load balancer |
| `FORCE_HTTPS` | | `1` adds a Strict-Transport-Security header |

## Deploy

### VPS (Ubuntu) with Nginx and HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
# install Node 22 from nodesource or nvm, then:
sudo mkdir -p /opt/fintax && sudo cp -r . /opt/fintax
sudo tee /etc/systemd/system/fintax.service >/dev/null <<'UNIT'
[Unit]
Description=FinTax
After=network.target
[Service]
WorkingDirectory=/opt/fintax
Environment=PORT=8080 FINTAX_DATA=/var/lib/fintax TRUST_PROXY=1 FORCE_HTTPS=1
Environment=ADMIN_EMAIL=you@yourdomain.pk ADMIN_PASSWORD=change-me
ExecStart=/usr/bin/node server/server.js
Restart=always
User=www-data
[Install]
WantedBy=multi-user.target
UNIT
sudo mkdir -p /var/lib/fintax && sudo chown www-data /var/lib/fintax
sudo systemctl enable --now fintax
```

Nginx site:

```nginx
server {
  server_name app.yourdomain.pk;
  client_max_body_size 40m;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then `sudo certbot --nginx -d app.yourdomain.pk`. Remove `ADMIN_PASSWORD` from the unit file after your first sign-in.

### Docker

```bash
docker build -t fintax .
docker run -d -p 8080:8080 -v fintax-data:/data -e ADMIN_EMAIL=you@yourdomain.pk -e ADMIN_PASSWORD=change-me fintax
```

### Hosting panels

Render, Railway, Fly.io and cPanel "Setup Node.js App" all work: set the start command to `node server/server.js`, point `FINTAX_DATA` at a persistent disk, and add the environment variables above.

## After you go live

1. Sign in as admin and change your password (top right, My profile).
2. Admin, Settings, How practices pay you: add your bank, IBAN, Raast, JazzCash and Easypaisa details.
3. Admin, Website content, Logo and colours: upload your PNG logo. It replaces the placeholder everywhere and becomes the phone app icon.
4. Admin, Website content, Contact and social: add your email, phone and WhatsApp.
5. Admin, Plans and pricing: confirm the two plans and prices.
6. Admin, Website content, Offer and urgency: set the founding offer seats and closing date, and the featured deadline.
7. Admin, Settings, Compliance calendar and Tax calculator: check dates and slabs each budget season. SRB, KPRA and BRA deadlines ship switched off until you confirm their current dates.

## How subscription payments work

A practice starts a free trial, then chooses a plan under Subscription, transfers the amount, and submits the transaction ID with an optional receipt. You approve it under Admin, Payments, which activates the plan for one month or one year and notifies the practice. When a subscription ends, the account becomes read-only: nothing is deleted and the practice can renew at any time.

## Data, security and backups

- Every query is scoped to the signed-in practice or client in `public/core/core.js`, and file downloads are authorised against the same rules.
- Passwords are hashed with scrypt. Saved portal credentials are encrypted with AES-256-GCM and each view is logged.
- The server sends a strict Content Security Policy and rate-limits sign-in, sign-up and contact forms.
- Back up the whole `FINTAX_DATA` folder (database, `uploads/`, `secret.key`). Admin, Settings, Data and backup also downloads a full JSON export.

## Project layout

```
public/          everything the browser loads
  core/core.js   business logic, permissions and tenancy (shared with the server)
  core/seed.js   demo data
  js/            website, admin, consultant and portal screens
  css/app.css    design system
  sw.js, manifest.webmanifest, icons/
server/server.js zero-dependency Node server: API, sessions, uploads, storage
tests/           core logic tests (npm test)
build/           bundles everything into one HTML file for demos (npm run build:preview)
```

Opening `public/index.html` from any static host without the server runs FinTax in demo mode, with data kept in that browser only.

## Good next steps

- Email or SMS notifications (WhatsApp click-to-chat links are built in today).
- An online payment gateway for subscriptions alongside manual verification.
- An Urdu interface for the client portal.
