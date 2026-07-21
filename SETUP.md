# Budget App v2 — Setup Guide

Text yourself on WhatsApp (`Guzman 11.8`) → the backend classifies it with
`gpt-5-nano` → it appears in the app with charts, categories, fixed expenses,
an independent SWS fund, and automatic currency from your location.

```
budget-app/
  backend/   Node + Express + SQLite + Baileys (WhatsApp) + OpenAI
  app/       Expo (React Native) — builds to an APK
```

---

## 1. Run locally (first test)

### Backend

```bash
cd backend
npm install
# .env already has your OpenAI key and a generated JWT_SECRET
node index.js
```

The API runs on `http://localhost:3001`. To test without WhatsApp:
`WHATSAPP_ENABLED=false node index.js`.

### App

```bash
cd app
npm install
npx expo start
```

Scan the QR with the Expo Go app. On the login screen, tap **Server settings**
and enter `http://<your-PC's-LAN-IP>:3001` (find it with `ipconfig` — must be
the LAN IP, not localhost, since the phone connects over Wi-Fi).

---

## 2. Deploy the backend (Railway)

1. Push this repo to GitHub.
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
3. In the service settings, set **Root Directory** to `backend` (it auto-detects the Dockerfile).
4. **Variables** tab — set:
   | Variable | Value |
   |---|---|
   | `OPENAI_API_KEY` | your key |
   | `OPENAI_MODEL` | `gpt-5-nano` |
   | `JWT_SECRET` | run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `DATA_DIR` | `/data` |
5. **Add a Volume** mounted at `/data` — this persists the database, the
   encryption master key, and WhatsApp sessions across deploys. Don't skip it.
6. Settings → Networking → **Generate Domain**. Note the URL
   (e.g. `https://budget-api-production.up.railway.app`).

Any always-on Node host works the same way (Render, Fly.io, a VPS) — the only
requirements are a persistent disk at `DATA_DIR` and an outbound internet
connection (WhatsApp, OpenAI, exchange rates).

## 3. Point the app at your backend and build the APK

1. Edit `app/src/api.js` → set `DEFAULT_API_URL` to your Railway URL
   (users can also override it per-device from the login screen).
2. Build:

```bash
cd app
npm install -g eas-cli   # once
eas login                # your Expo account (same as GoldLabel)
eas build -p android --profile preview
```

When it finishes, EAS gives you a download link for the **APK**. Install it on
your phone and share the same link with anyone else — each person registers
their own account and gets their own isolated data and WhatsApp link.

---

## 4. Onboarding (you)

1. Open the app → **Get started**. There is no email or password: the app
   creates an account tied to this device and shows a **recovery code**.
   Save that code — it is the only way to reach your data from another phone.
   (You can see it again anytime under Settings → Recovery code.)
2. Allow **location** when asked (this is what makes `75` typed in Malaysia
   log as 75 MYR while your dashboard stays in SGD).
3. Settings → **Fixed monthly expenses** → add yours:
   Claude 25.00 · Phone plan 19.90 · Spotify 6.00 · VPN 2.88.
4. Misc Fund tab → **Set balance** to your current fund amount.
5. Settings → **Link WhatsApp** → enter your phone number → get the pairing
   code → WhatsApp → Settings → Linked Devices → Link a Device →
   **Link with phone number instead** → type the code.
   (The QR option is for when WhatsApp lives on a different phone.)

## 5. Message formats (Note to Self)

| You text | What happens |
|---|---|
| `Guzman 11.8` | 11.80 logged as Food ✅ |
| `grab 14.5` | Transport ✅ |
| `bubble tea 3` | Drinks ✅ |
| `75` (while in Malaysia) | 75 MYR, converted to SGD in the backend ✅ |
| `75 myr nasi lemak` | explicit currency override ✅ |
| `laptop 1200` | logged + flagged heavy ⚠️ |
| `sws 20 groceries` | 20 out of the SWS fund — **not** in monthly spending 🏦 |
| `nsws 50` | 50 back into the SWS fund 💰 |
| reply to a logged message | corrects that entry ✏️ |
| reply `delete` | removes that entry 🗑️ |
| `buy milk tomorrow` | ignored (no number / not an expense) |

The bot **only reacts with emoji** — it never sends messages, and it only ever
reads your own Note-to-Self chat.

---

## Why the old bugs can't come back

- **Infinite logging**: the old bot sent text confirmations that WhatsApp echoed
  back as new messages, guarded only by an in-memory set that died on restart.
  The new bot sends *no messages at all* (emoji reactions can't echo), every
  processed message ID is stored in SQLite, and anything older than 10 minutes
  is ignored — so restarts and history replays can't re-log.
- **Misclassification**: `sws`/`nsws` and currency codes are parsed
  deterministically in code before the LLM sees anything; the LLM only picks
  amount/category/description under a strict JSON schema, with clear category
  definitions and a "not an expense → amount 0" rule.
- **SWS mixing into monthly totals**: SWS transactions live in their own table.
  The stats endpoints only read the expenses table, so they can never mix.

## Security

- Passwords: bcrypt. Sessions: signed JWTs (90-day expiry).
- Expense descriptions and raw messages: AES-256-GCM encrypted at rest, with a
  per-user data key wrapped by a server master key (auto-generated into
  `DATA_DIR/master.key`, or supply `ENCRYPTION_KEY` as an env var).
- Every API route is per-user; one account can never read another's data.
- Auth token on the phone is stored in the device keychain (expo-secure-store).
