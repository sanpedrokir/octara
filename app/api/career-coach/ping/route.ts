export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ ok: false, reason: 'GEMINI_API_KEY not set in environment' });

  // Quick test call to Gemini
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say "ok"' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    );
    const body = await res.text();
    return Response.json({ ok: res.ok, status: res.status, keyPrefix: apiKey.slice(0, 6) + '...', body: body.slice(0, 300) });
  } catch (err) {
    return Response.json({ ok: false, reason: err instanceof Error ? err.message : String(err) });
  }
}
