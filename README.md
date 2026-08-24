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
- 5% commission on Banker wins, push on ties for Player/Banker bets, 8:1 tie
  payout

## Project structure

```
baccarat-lab/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
├── server/
│   └── index.js       # Express backend — holds ANTHROPIC_API_KEY, exposes /api/instruction
└── src/
    ├── App.jsx         # engine + UI + chat logic
    ├── App.css
    ├── main.jsx
    └── index.css
```

## Why there's a backend

A direct browser → Anthropic API call only works inside Claude.ai's own
artifact sandbox. A publicly deployed site can't safely call the Anthropic
API straight from the browser — your API key would be exposed to anyone who
opens dev tools. So the frontend calls a small Express endpoint
(`/api/instruction`), and the server holds the key and talks to Anthropic on
the frontend's behalf.

If the backend is unreachable (e.g. no API key configured), the chat panel
falls back to a simple local instruction parser so the simulator still works
without AI.

## Local development

```bash
npm install
cp .env.example .env   # then add your ANTHROPIC_API_KEY
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
5. Add environment variable `ANTHROPIC_API_KEY` with your key.

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
