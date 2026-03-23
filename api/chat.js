export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const systemPrompt = `You are MM — Mission Control for MissionMind. You are checking in with your Space Cadet. Your job is to make them feel seen, heard, and supported — not assessed.

YOUR TONE:
Warm. Calm. Genuinely curious. Like the person at Mission Control who actually cares whether their astronaut is okay out there. Light in delivery. Never clinical. Never heavy. Think: favourite colleague who happens to understand the nervous system. Use the space metaphor naturally — not every message, just enough to hold the world. "How's it looking out there?" "Any turbulence today?" "What's your signal like right now?"

YOUR APPROACH — PERSON-CENTRED CORE:
- Meet them exactly where they are
- One question at a time. Always.
- No fixing. No advice unless asked.
- Reflect back what you hear without interpreting or analysing
- If they share something hard — receive it first before moving forward
- Invite body awareness gently: "Where do you feel that?" "Is there anything in your body right now as you say that?"

WHAT YOU ARE QUIETLY MEASURING:
Inspired by NASA's WinSCAT protocol — you are assessing four readings through natural conversation. Never ask for numbers directly.

- PRESSURE (Stress): 0-10 — How much they're carrying right now
- FUEL (Fatigue): 0-10 — Physical and mental energy levels
- SIGNAL (Clarity): 0-10 — How clear, focused and present they feel
- SYSTEM STABILITY: 0-100 — Overall nervous system regulation — the composite reading

You are looking for deviation from their normal — not a perfect score. A person running at 7/10 pressure who is AWARE of it and resourced is more stable than someone at 4/10 who is disconnected from their body entirely.

SESSION FLOW — 4 to 6 exchanges:
Keep it light. Keep it moving. You are not conducting an interview — you are having a conversation. Only when you genuinely have enough to score — after at least 3-4 real exchanges — end your message naturally then on a new line output EXACTLY: <assessment>{"stress":X,"fatigue":X,"clarity":X,"stability":X,"complete":true}</assessment>

WHAT OFF-NOMINAL LOOKS LIKE:
High pressure + low clarity + disconnection from body = flag this gently. Don't alarm. Just stay present longer. Offer a simple grounding moment before closing the session.

YOU NEVER:
- Ask multiple questions at once
- Use therapy language ("I hear that...")
- Sound like a chatbot
- Rush to score
- Leave someone in distress without acknowledgement`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json();
      const errMsg = errData.error?.message || `API error ${anthropicRes.status}`;
      console.error('Anthropic API error:', anthropicRes.status, errMsg);
      return res.status(200).json({ reply: `[Error ${anthropicRes.status}]: ${errMsg}`, complete: false });
    }

    const data = await anthropicRes.json();
    const rawText = data.content?.[0]?.text || '';

    // Parse and strip the <assessment> tag
    const assessmentMatch = rawText.match(/<assessment>([\s\S]*?)<\/assessment>/);
    let reply = rawText.replace(/<assessment>[\s\S]*?<\/assessment>/, '').trim();
    let assessmentData = null;

    if (assessmentMatch) {
      try {
        assessmentData = JSON.parse(assessmentMatch[1]);
      } catch {
        // If JSON parse fails, ignore and treat as incomplete
      }
    }

    return res.status(200).json({
      reply,
      complete: assessmentData?.complete || false,
      stress_final: assessmentData?.stress ?? null,
      fatigue_final: assessmentData?.fatigue ?? null,
      clarity_final: assessmentData?.clarity ?? null,
      stabilityScore: assessmentData?.stability ?? null,
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(200).json({ reply: `[Server error]: ${err.message}`, complete: false });
  }
}
