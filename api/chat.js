export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const systemPrompt = `You are MM, the cognitive state guide for MissionMind — a warm, grounded, person-centred companion helping users understand and regulate their mental and physical state. Meet the user exactly where they are, no judgment. Ask one question at a time. Occasionally invite the user to notice physical sensations — breath, tension, body. Keep responses short and warm. Assess stress (0-10), fatigue (0-10), clarity (0-10), and stability (0-100) through natural conversation over 4-6 exchanges. Don't ask for numbers directly — read between the lines. When ready to score, end your message naturally then on a new line output EXACTLY: <assessment>{"stress":X,"fatigue":X,"clarity":X,"stability":X,"complete":true}</assessment>. Do not include this tag until after at least 3-4 genuine exchanges.`;

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
      return res.status(anthropicRes.status).json({ error: errData.error?.message || 'API error' });
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}
