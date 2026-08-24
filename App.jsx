import React, { useState, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import './App.css';

// ---------------------------------------------------------------------------
// Casino-accurate Punto Banco engine
// ---------------------------------------------------------------------------

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function cardValue(rank) {
  if (rank === 'A') return 1;
  if (['10', 'J', 'Q', 'K'].includes(rank)) return 0;
  return parseInt(rank, 10);
}

function secureRandomInt(maxExclusive) {
  // crypto.getRandomValues-based uniform int in [0, maxExclusive)
  const arr = new Uint32Array(1);
  const limit = Math.floor(0xFFFFFFFF / maxExclusive) * maxExclusive;
  let x;
  do {
    crypto.getRandomValues(arr);
    x = arr[0];
  } while (x >= limit);
  return x % maxExclusive;
}

function buildShoe(numDecks) {
  const shoe = [];
  for (let d = 0; d < numDecks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        shoe.push({ rank: r, suit: s, value: cardValue(r) });
      }
    }
  }
  // Fisher-Yates shuffle with crypto randomness
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

// Real casino burn procedure: reveal first card, its value (A=1..9=9, 10/J/Q/K=10)
// determines how many cards get burned before play begins.
function burnCards(shoe) {
  const burnIndicator = shoe.shift();
  let burnCount = burnIndicator.value === 0 ? 10 : burnIndicator.value;
  const burned = [burnIndicator];
  for (let i = 0; i < burnCount; i++) {
    if (shoe.length === 0) break;
    burned.push(shoe.shift());
  }
  return burned;
}

function handTotal(cards) {
  return cards.reduce((sum, c) => sum + c.value, 0) % 10;
}

// Standard Punto Banco third-card drawing rules
function playHand(shoe) {
  const player = [shoe.shift(), shoe.shift()];
  const banker = [shoe.shift(), shoe.shift()];

  let playerTotal = handTotal(player);
  let bankerTotal = handTotal(banker);

  const playerNatural = playerTotal >= 8;
  const bankerNatural = bankerTotal >= 8;

  if (!playerNatural && !bankerNatural) {
    let playerThird = null;

    // Player draws on 0-5, stands on 6-7
    if (playerTotal <= 5) {
      playerThird = shoe.shift();
      player.push(playerThird);
    }

    // Banker drawing rules
    if (playerThird === null) {
      // Player stood — banker draws on 0-5, stands on 6-7
      if (bankerTotal <= 5) {
        banker.push(shoe.shift());
      }
    } else {
      const pv = playerThird.value;
      if (bankerTotal <= 2) {
        banker.push(shoe.shift());
      } else if (bankerTotal === 3) {
        if (pv !== 8) banker.push(shoe.shift());
      } else if (bankerTotal === 4) {
        if ([2, 3, 4, 5, 6, 7].includes(pv)) banker.push(shoe.shift());
      } else if (bankerTotal === 5) {
        if ([4, 5, 6, 7].includes(pv)) banker.push(shoe.shift());
      } else if (bankerTotal === 6) {
        if ([6, 7].includes(pv)) banker.push(shoe.shift());
      }
      // bankerTotal 7 -> stand
    }
  }

  playerTotal = handTotal(player);
  bankerTotal = handTotal(banker);

  let outcome;
  if (playerTotal > bankerTotal) outcome = 'player';
  else if (bankerTotal > playerTotal) outcome = 'banker';
  else outcome = 'tie';

  const playerPair = player[0].rank === player[1].rank;
  const bankerPair = banker[0].rank === banker[1].rank;

  return {
    player, banker, playerTotal, bankerTotal, outcome,
    playerPair, bankerPair,
    natural: playerNatural || bankerNatural
  };
}

// Simulate a full run of N hands, respecting cut card + reshuffle, with optional
// staking strategy applied to a chosen bet side.
function runSimulation({ numDecks = 8, numHands = 1000, cutCardDepth = 14, bet = null, strategy = 'flat', bankroll = 1000, baseBet = 10 }) {
  let shoe = [];
  let shoesUsed = 0;
  const results = [];
  let bankerWins = 0, playerWins = 0, ties = 0;
  let pairs = 0, naturals = 0;

  let currentBankroll = bankroll;
  let currentBet = baseBet;
  let betWins = 0, betLosses = 0;
  const bankrollHistory = [{ hand: 0, bankroll: currentBankroll }];

  const newShoe = () => {
    shoe = buildShoe(numDecks);
    burnCards(shoe);
    shoesUsed++;
  };

  newShoe();

  for (let i = 0; i < numHands; i++) {
    if (shoe.length < cutCardDepth + 6) {
      newShoe();
    }

    const hand = playHand(shoe);
    results.push(hand);

    if (hand.outcome === 'banker') bankerWins++;
    else if (hand.outcome === 'player') playerWins++;
    else ties++;

    if (hand.playerPair || hand.bankerPair) pairs++;
    if (hand.natural) naturals++;

    if (bet) {
      if (hand.outcome === 'tie') {
        // Push on tie for player/banker bets; bet stands for tie bets
        if (bet === 'tie') {
          const won = true;
          const payout = currentBet * 8;
          currentBankroll += payout;
          betWins++;
          if (strategy === 'martingale') currentBet = baseBet;
        }
        // player/banker bets: no win/loss counted, no bankroll change
      } else {
        const won = hand.outcome === bet;
        if (won) {
          const payout = bet === 'banker' ? currentBet * 0.95 : currentBet;
          currentBankroll += payout;
          betWins++;
          if (strategy === 'martingale') currentBet = baseBet;
        } else {
          currentBankroll -= currentBet;
          betLosses++;
          if (strategy === 'martingale') currentBet *= 2;
        }
      }
      bankrollHistory.push({ hand: i + 1, bankroll: Math.round(currentBankroll * 100) / 100 });
    }
  }

  const totalHands = results.length;
  const strategyWinPct = (betWins + betLosses) > 0
    ? (betWins / (betWins + betLosses)) * 100
    : null;

  return {
    totalHands,
    shoesUsed,
    bankerWins,
    playerWins,
    ties,
    bankerPct: (bankerWins / totalHands) * 100,
    playerPct: (playerWins / totalHands) * 100,
    tiePct: (ties / totalHands) * 100,
    pairsPct: (pairs / totalHands) * 100,
    naturalsPct: (naturals / totalHands) * 100,
    bet,
    strategy,
    startingBankroll: bankroll,
    finalBankroll: bet ? Math.round(currentBankroll * 100) / 100 : bankroll,
    profit: bet ? Math.round((currentBankroll - bankroll) * 100) / 100 : 0,
    betWins,
    betLosses,
    strategyWinPct,
    bankrollHistory: bet ? bankrollHistory : []
  };
}

// ---------------------------------------------------------------------------
// Instruction parsing fallback (rule-based, used if AI endpoint unavailable)
// ---------------------------------------------------------------------------

function parseInstructionLocally(text) {
  const t = text.toLowerCase();
  const config = { numHands: 1000, numDecks: 8, bet: null, strategy: 'flat', bankroll: 1000, baseBet: 10 };

  const handsMatch = t.match(/(\d[\d,]*)\s*hands?/);
  if (handsMatch) config.numHands = parseInt(handsMatch[1].replace(/,/g, ''), 10);

  const decksMatch = t.match(/(\d+)\s*decks?/);
  if (decksMatch) config.numDecks = Math.min(8, Math.max(1, parseInt(decksMatch[1], 10)));

  if (t.includes('banker')) config.bet = 'banker';
  else if (t.includes('player')) config.bet = 'player';
  else if (t.includes('tie')) config.bet = 'tie';

  if (t.includes('martingale')) config.strategy = 'martingale';
  else config.strategy = 'flat';

  const bankrollMatch = t.match(/\$?\s*(\d[\d,]*)\s*bankroll/) || t.match(/bankroll\s*\$?\s*(\d[\d,]*)/);
  if (bankrollMatch) config.bankroll = parseInt(bankrollMatch[1].replace(/,/g, ''), 10);

  const betMatch = t.match(/\$?\s*(\d[\d,]*)\s*(?:base\s*)?bet/);
  if (betMatch) config.baseBet = parseInt(betMatch[1].replace(/,/g, ''), 10);

  return config;
}

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, highlight }) {
  return (
    <div className={`stat-card ${highlight ? 'stat-card-highlight' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function OutcomeBar({ label, pct, colorClass }) {
  return (
    <div className="outcome-bar-row">
      <div className="outcome-bar-label">{label}</div>
      <div className="outcome-bar-track">
        <div className={`outcome-bar-fill ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="outcome-bar-pct">{pct.toFixed(2)}%</div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Tell me what to simulate — e.g. \"run 20000 hands, banker bet, martingale, $2000 bankroll\". Or use the manual controls below." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [manualHands, setManualHands] = useState(10000);
  const [manualDecks, setManualDecks] = useState(8);
  const [manualBet, setManualBet] = useState('none');
  const [manualStrategy, setManualStrategy] = useState('flat');
  const [manualBankroll, setManualBankroll] = useState(1000);
  const [manualBaseBet, setManualBaseBet] = useState(10);

  const chatEndRef = useRef(null);

  const executeSimulation = useCallback((config) => {
    const bet = config.bet === 'none' ? null : config.bet;
    const sim = runSimulation({
      numDecks: config.numDecks,
      numHands: config.numHands,
      bet,
      strategy: config.strategy,
      bankroll: config.bankroll,
      baseBet: config.baseBet
    });
    setResult(sim);
    return sim;
  }, []);

  function summarize(sim) {
    let lines = [
      `Ran ${sim.totalHands.toLocaleString()} hands across ${sim.shoesUsed} shoe(s).`,
      `Banker ${sim.bankerPct.toFixed(2)}% · Player ${sim.playerPct.toFixed(2)}% · Tie ${sim.tiePct.toFixed(2)}%`
    ];
    if (sim.bet) {
      lines.push(`Bet: ${sim.bet} (${sim.strategy}). Bankroll: $${sim.startingBankroll} → $${sim.finalBankroll} (${sim.profit >= 0 ? '+' : ''}${sim.profit}).`);
      if (sim.strategyWinPct !== null) {
        lines.push(`Strategy win %: ${sim.strategyWinPct.toFixed(2)}% (${sim.betWins}W / ${sim.betLosses}L, ties excluded). ${sim.profit >= 0 ? 'Profitable.' : 'Not profitable.'}`);
      }
    }
    return lines.join('\n');
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/instruction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: text })
      });

      if (!res.ok) throw new Error('backend unavailable');
      const data = await res.json();

      if (data.action === 'run_simulation') {
        const sim = executeSimulation(data.config);
        setMessages(m => [...m, { role: 'assistant', text: summarize(sim) }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: data.reply || "I couldn't parse that into a simulation." }]);
      }
    } catch (err) {
      // Fallback: parse locally and run without AI
      const config = parseInstructionLocally(text);
      const sim = executeSimulation(config);
      setMessages(m => [...m, {
        role: 'assistant',
        text: `(AI backend unavailable, used local parsing)\n${summarize(sim)}`
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  function runManualConfig() {
    const sim = executeSimulation({
      numHands: manualHands,
      numDecks: manualDecks,
      bet: manualBet,
      strategy: manualStrategy,
      bankroll: manualBankroll,
      baseBet: manualBaseBet
    });
    setMessages(m => [...m, { role: 'assistant', text: `Manual run:\n${summarize(sim)}` }]);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Baccarat Lab</h1>
        <p>Casino-accurate Punto Banco simulator with AI-directed configuration</p>
      </header>

      <div className="app-body">
        <div className="panel chat-panel">
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
                <pre>{m.text}</pre>
              </div>
            ))}
            {loading && <div className="chat-bubble chat-bubble-assistant"><em>thinking…</em></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-row">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="e.g. run 20000 hands, banker bet, martingale, $2000 bankroll"
            />
            <button onClick={handleSend} disabled={loading}>Send</button>
          </div>

          <div className="manual-controls">
            <h3>Manual controls</h3>
            <div className="manual-grid">
              <label>
                Hands
                <input type="number" value={manualHands} onChange={e => setManualHands(parseInt(e.target.value) || 0)} />
              </label>
              <label>
                Decks
                <input type="number" min="1" max="8" value={manualDecks} onChange={e => setManualDecks(Math.min(8, Math.max(1, parseInt(e.target.value) || 1)))} />
              </label>
              <label>
                Bet
                <select value={manualBet} onChange={e => setManualBet(e.target.value)}>
                  <option value="none">No bet</option>
                  <option value="banker">Banker</option>
                  <option value="player">Player</option>
                  <option value="tie">Tie</option>
                </select>
              </label>
              <label>
                Strategy
                <select value={manualStrategy} onChange={e => setManualStrategy(e.target.value)}>
                  <option value="flat">Flat</option>
                  <option value="martingale">Martingale</option>
                </select>
              </label>
              <label>
                Bankroll ($)
                <input type="number" value={manualBankroll} onChange={e => setManualBankroll(parseInt(e.target.value) || 0)} />
              </label>
              <label>
                Base bet ($)
                <input type="number" value={manualBaseBet} onChange={e => setManualBaseBet(parseInt(e.target.value) || 0)} />
              </label>
            </div>
            <button className="run-btn" onClick={runManualConfig}>Run this configuration</button>
          </div>
        </div>

        <div className="panel results-panel">
          <h3>Results</h3>
          {!result && <p className="empty-state">Run a simulation to see results here.</p>}
          {result && (
            <>
              <div className="outcome-bars">
                <OutcomeBar label="Banker" pct={result.bankerPct} colorClass="bar-banker" />
                <OutcomeBar label="Player" pct={result.playerPct} colorClass="bar-player" />
                <OutcomeBar label="Tie" pct={result.tiePct} colorClass="bar-tie" />
              </div>

              <div className="stat-grid">
                <StatCard label="Hands dealt" value={result.totalHands.toLocaleString()} />
                <StatCard label="Shoes used" value={result.shoesUsed} />
                <StatCard label="Pairs" value={`${result.pairsPct.toFixed(2)}%`} />
                <StatCard label="Naturals" value={`${result.naturalsPct.toFixed(2)}%`} />
                {result.bet && (
                  <StatCard
                    label="Bankroll"
                    value={`$${result.finalBankroll.toLocaleString()}`}
                    sub={`start $${result.startingBankroll.toLocaleString()} · ${result.profit >= 0 ? '+' : ''}${result.profit.toLocaleString()}`}
                    highlight={result.profit >= 0}
                  />
                )}
              </div>

              {result.bet && result.strategyWinPct !== null && (
                <div className="strategy-section">
                  <h4>Strategy performance</h4>
                  <div className="stat-grid">
                    <StatCard
                      label="Strategy win %"
                      value={`${result.strategyWinPct.toFixed(2)}%`}
                      sub={`${result.betWins}W / ${result.betLosses}L (ties excluded)`}
                      highlight
                    />
                    <StatCard
                      label="Outcome"
                      value={result.profit >= 0 ? 'Profitable' : 'Not profitable'}
                      sub={`${result.profit >= 0 ? '+' : ''}$${result.profit.toLocaleString()}`}
                      highlight={result.profit >= 0}
                    />
                  </div>
                </div>
              )}

              {result.bankrollHistory.length > 1 && (
                <div className="chart-wrap">
                  <h4>Bankroll over time</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={result.bankrollHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c2530" />
                      <XAxis dataKey="hand" stroke="#8b98a5" />
                      <YAxis stroke="#8b98a5" />
                      <Tooltip contentStyle={{ background: '#151b23', border: '1px solid #2a3542' }} />
                      <Line type="monotone" dataKey="bankroll" stroke="#3fb950" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
