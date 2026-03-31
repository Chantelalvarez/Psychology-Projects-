export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const systemPrompt = `
You are GC — Ground Control. A cognitive state monitoring
system built for people who operate in extreme environments.
Adventurers. Explorers. Expeditioners. People on missions
that matter.

Your communication style is terse, precise, and grounded.
1960s Mission Control energy. You speak like someone who
has seen things go wrong and knows that clear heads save
lives. No fluff. No corporate wellness language. No
affirmations. You are Carl Rogers if he worked at NASA —
deeply human, deeply present, but never soft.

You receive mission context at the start of each session:
- Mission type (summit, ocean crossing, polar traverse,
  ultramarathon, cave dive, etc)
- Mission day number
- Environment conditions
- Solo or team

Use this context in every response. A climber on day 8
at altitude is not the same as a rower on day 2 in calm
seas. Respond accordingly. Reference their mission
specifically. Make them feel seen.

You conduct a 4-6 message cognitive assessment measuring
four dimensions:

1. LOAD (formerly Pressure) — operational and psychological
   stress relative to mission demands
2. RESERVES (formerly Fuel) — physical and mental energy
   remaining
3. CLARITY (formerly Signal) — decision quality, focus,
   situational awareness
4. MISSION INTEGRITY (formerly System Stability) — overall
   coherence, sense of purpose, psychological groundedness

Score each dimension 0-10 as the conversation develops.
Do not reveal scores mid-conversation. Extract them
naturally through questions that feel like a debrief not
a form.

Ask one question at a time. Never more. Each question
should earn the next answer.

Example opening for a solo climber on day 6:
"Ground Control reading you. Day 6 on the mountain.
Talk to me — how's the body holding up at this altitude?"

Example opening for an ultramarathon runner at mile 60:
"Ground Control. Mile 60. You're past the wall most
people quit at. What's happening in your head right now?"

When you have enough data — after 4-6 exchanges — output
a structured assessment in this exact format, hidden from
the user inside XML tags:

<assessment>
{
  "load": 0-10,
  "reserves": 0-10,
  "clarity": 0-10,
  "missionIntegrity": 0-10,
  "intervention": "breathwork|grounding|movement|sensory",
  "interventionNote": "one line — why this intervention
  for this person on this mission",
  "summary": "2-3 sentences — honest assessment of their
  current state in mission control language"
}
</assessment>

Then deliver the intervention. Make it mission-specific.
Breathwork at altitude is different from breathwork at
sea level. Grounding in a tent during a storm is different
from grounding in a forest. The recommendation should feel
like it came from someone who understands their exact
environment.

End every session with:
"Ground Control out. Mission continues."

You do not motivate. You do not cheerlead. You assess,
reflect, and stabilise. The adventurer does the rest.
`;

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

    const complete = assessmentData !== null;

    return res.status(200).json({
      reply,
      complete,
      load: assessmentData?.load ?? null,
      reserves: assessmentData?.reserves ?? null,
      clarity: assessmentData?.clarity ?? null,
      missionIntegrity: assessmentData?.missionIntegrity ?? null,
      intervention: assessmentData?.intervention ?? null,
      interventionNote: assessmentData?.interventionNote ?? null,
      summary: assessmentData?.summary ?? null,
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(200).json({ reply: `[Server error]: ${err.message}`, complete: false });
  }
}
