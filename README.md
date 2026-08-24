# Baccarat Lab

A casino-accurate Punto Banco (baccarat) simulator with an AI-directed control
panel. Type plain-English instructions ("run 20000 hands, banker bet,
martingale, $2000 bankroll") and it configures and runs the simulation for
you, or ask general questions about baccarat.

## Casino-accurate defaults

- 8-deck shoe (standard for Punto Banco worldwide), configurable 1–8
- Fresh shuffle every shoe using `crypto.getRandomValues` (cryptographically
  strong randomness, not `Math.random`)
- Real burn-card procedure: the first card revealed after a shuffle sets how
  many cards are burned before play begins, exactly like a live table
- Cut card placed 14 cards from the end of the shoe — play stops there and a
  new shoe is shuffled, rather than dealing until the shoe is exhausted
- Standard third-card drawing rules (player draws 0–5, banker table-based
  rules), naturals on 8/9
- 5% commission on Banker wins, push on ties for Player/Banker bets
- Tie payout defaults to **9:1** (the common online-casino standard), with an
  8:1 (land-based standard) option selectable in manual controls or via
  instruction (e.g. "run 5000 hands, tie bet, 8:1")
- Every hand is individually dealt from a real shuffled shoe — nothing is
  approximated from odds tables. Large runs process in chunks with a visible
  progress overlay so the browser tab stays responsive instead of freezing

## Project structure

```
baccarat-lab/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
├── server/
└── server.js           # Express backend — holds OPENROUTER_API_KEY, exposes /api/instruction
└── src/
    ├── App.jsx         # engine + UI + chat logic
    ├── App.css
    ├── main.jsx
    └── index.css
```

## Why there's a backend

A direct browser → AI API call would expose your API key to anyone who opens
dev tools on a public site. So the frontend calls a small Express endpoint
(`/api/instruction`), and the server holds the key and talks to OpenRouter on
the frontend's behalf.

This project uses [OpenRouter](https://openrouter.ai) rather than calling
Anthropic directly, since OpenRouter gives you a single API key with access
to many models — including several free ones — so you can try it out before
spending anything.

If the backend is unreachable (e.g. no API key configured), the chat panel
falls back to a simple local instruction parser so the simulator still works
without AI.

## Getting an OpenRouter API key

1. Sign up at [openrouter.ai](https://openrouter.ai).
2. Go to **Keys** → **Create Key**.
3. Copy the key (starts with `sk-or-`).
4. Free models (like the default `meta-llama/llama-3.3-70b-instruct:free`)
   don't require adding credit — paid models do. See the
   [models page](https://openrouter.ai/models) to browse options and pricing.

## Local development

```bash
npm install
cp .env.example .env   # then add your OPENROUTER_API_KEY
npm run build
npm start
```

Or run the Vite dev server (proxies `/api` to the Express server) alongside
the backend in a second terminal:

```bash
npm run dev            # terminal 1 — Vite on :5173
npm run server:dev      # terminal 2 — Express on :3001
```

## Deploying to Render

1. Push this repo to GitHub.
2. In Render: **New → Web Service**, connect the repo.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variable `OPENROUTER_API_KEY` with your key (optionally
   also `OPENROUTER_MODEL` if you want a different model than the free
   default).

Render builds the Vite frontend into `dist/` and Express serves both the
static site and the `/api/instruction` endpoint from the same process.

## What the results show

- **Banker / Player / Tie %** — raw distribution of hand outcomes across the
  whole run (house math, independent of any bet placed)
- **Bankroll** — starting vs. final bankroll and net profit/loss, shown when
  a bet is active
- **Bankroll over time** — equity curve chart, hand-by-hand
- **Strategy win %** — of your placed bets specifically: wins ÷ (wins +
  losses), with pushed ties excluded entirely — plus a Profitable / Not
  profitable label and the W/L count

Baccarat hands are independent from one shoe cut to the next in a properly
shuffled shoe — the simulator reports actual results against fixed house
math, not a predictive "accuracy" score.
