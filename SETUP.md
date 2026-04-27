# Budget App — Setup Guide

## Local Development

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY
```

To run without WhatsApp (just the API):
```bash
WHATSAPP_ENABLED=false node index.js
```

To run with WhatsApp bot:
```bash
node index.js
# Scan the QR code printed in the terminal with your WhatsApp
```

### 2. Frontend

```bash
cd frontend
npm run dev
# Open http://localhost:5173
```

The Vite proxy is configured to forward `/api/*` to `http://localhost:3001`, so
both servers can run together in local dev with no extra config.

---

## WhatsApp Message Format

| Message | Effect |
|---------|--------|
| `5.50 chicken rice` | Logs $5.50 as Food |
| `3 bubble tea drinks` | Logs $3 as Drinks |
| `45 grab transport` | Logs $45 as Transport |
| `sws 20 groceries fairprice` | Deducts $20 from SWS, NOT counted in monthly total |
| `nsws 50` | Adds $50 back to SWS fund (refund) |
| `1200 hotel vacation` | Logged + flagged as heavy one-time expense |

---

## Railway Deployment (Backend)

1. Create a new Railway project and connect your `budget-app/backend` folder
2. Railway will auto-detect the Dockerfile
3. Set environment variables in Railway dashboard:
   - `OPENAI_API_KEY` = your key
   - `FRONTEND_URL` = your Vercel URL (for CORS)
4. Add a **Volume** mounted at `/data` (so WhatsApp session and DB persist)
5. First deploy → click **Logs** → scan the QR code with WhatsApp

## Vercel Deployment (Frontend)

1. Connect your repo to Vercel, set **Root Directory** to `budget-app/frontend`
2. Add environment variable:
   - `VITE_API_URL` = your Railway backend URL (e.g. `https://budget-api.up.railway.app`)
3. Deploy

---

## Fixed Expenses

Pre-seeded on first run:
- Phone Plan: $19.90
- Spotify: $6.00
- Claude: $25.00
- NUHS: $106.25

Manage them from the **Settings** page in the app.

## SWS Fund

Starting balance: **$2,451.03** (from January B18 of your Excel file).
Adjust from the Settings page if needed.
