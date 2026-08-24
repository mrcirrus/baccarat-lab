import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json());

const SYSTEM_PROMPT = `You convert plain-English baccarat simulation instructions into a JSON config, or answer general questions about baccarat.

If the user is asking you to run/configure a simulation, respond ONLY with JSON (no prose, no markdown fences):
{
  "action": "run_simulation",
  "config": {
    "numHands": <integer, default 1000>,
    "numDecks": <integer 1-8, default 8>,
    "bet": <"banker" | "player" | "tie" | "none">,
    "strategy": <"flat" | "martingale">,
    "bankroll": <integer, default 1000>,
    "baseBet": <integer, default 10>
  }
}

If the user is asking a question (e.g. "explain why banker has an edge") rather than requesting a run, respond ONLY with JSON:
{
  "action": "answer",
  "reply": "<your plain-text answer>"
}

Never include anything outside the JSON object.`;

app.post('/api/instruction', async (req, res) => {
  const { instruction } = req.body;

  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: 'instruction is required' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: instruction }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'upstream API error' });
    }

    const data = await response.json();
    const textBlock = data.content.find(b => b.type === 'text');
    const raw = textBlock ? textBlock.text.trim() : '{}';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.json({ action: 'answer', reply: raw });
    }

    return res.json(parsed);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// Serve built frontend
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Baccarat Lab server running on port ${PORT}`);
});
