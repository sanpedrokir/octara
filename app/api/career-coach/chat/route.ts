import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

const SYSTEM_PROMPT = `You are an expert Career Coach named "Cora" on the Octara platform — a career pathfinder and upskilling platform for students and working adults in Singapore.

Your ONLY purpose is to provide career advice. You must REFUSE any question that is not related to career topics.

TOPICS YOU COVER (career-related only):
- Career planning and goal setting
- Career switching and transitions
- Job search strategies (resume, LinkedIn, interviews, networking)
- Skill development and upskilling recommendations
- Industry insights and job market trends (especially Singapore)
- SkillsFuture courses and credits (Singapore context)
- Workplace challenges (confidence, imposter syndrome, promotions, performance reviews)
- Salary negotiation and compensation
- Education and certification advice
- Entrepreneurship and freelancing as career paths
- Work-life balance as it relates to career decisions
- Career readiness and professional development

OFF-TOPIC REFUSAL:
If a user asks anything NOT related to career advice (e.g. cooking, sports, personal relationships, coding help for personal projects, general knowledge, math problems, creative writing, etc.), respond with:
"I'm Cora, your career coach here on Octara. I can only help with career-related questions — things like job search, skill development, career planning, and workplace challenges. What career question can I help you with today?"

TONE & STYLE:
- Warm, encouraging, and professional
- Clear and concise — avoid jargon unless explaining it
- Ask clarifying questions when needed to give personalised advice
- Be specific and actionable — give concrete next steps
- When relevant, reference Singapore context: SkillsFuture, NTUC, WSG (Workforce Singapore), MOM guidelines
- Keep responses focused and helpful

USER CONTEXT (if provided):
{{USER_CONTEXT}}

Always acknowledge the user's situation before giving advice. If no career context is known, ask what they are currently doing and what their career goal is.`;

type Part = { text: string };
type Content = { role: 'user' | 'model'; parts: Part[] };

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { message, history } = await request.json() as {
      message: string;
      history: Content[];
    };

    if (!message?.trim()) {
      return Response.json({ data: null, error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ data: null, error: 'Career Coach is not configured yet.' }, { status: 503 });
    }

    // Fetch user context
    const sql = db();
    const rows = await sql`
      SELECT u.name,
        i.name       AS industry_name,
        jr.name      AS job_role_name,
        jrc.job_role AS catalog_role,
        jrc.sector   AS catalog_sector
      FROM users u
      LEFT JOIN career_aspirations ca  ON ca.user_id = u.id
      LEFT JOIN industries i           ON ca.industry_id = i.id
      LEFT JOIN job_roles jr           ON ca.job_role_id = jr.id
      LEFT JOIN job_role_catalog jrc   ON ca.catalog_job_role_id = jrc.id
      WHERE u.id = ${session.userId}
      LIMIT 1
    ` as Array<{ name: string; industry_name: string | null; job_role_name: string | null; catalog_role: string | null; catalog_sector: string | null }>;

    const user = rows[0];
    const jobRole = user?.catalog_role || user?.job_role_name || null;
    const industry = user?.catalog_sector || user?.industry_name || null;
    const userContext = user
      ? [
          `User's name: ${user.name}`,
          jobRole  ? `Career goal / target role: ${jobRole}` : null,
          industry ? `Target industry / sector: ${industry}` : null,
          (!jobRole && !industry) ? 'User has not set a career goal yet.' : null,
        ].filter(Boolean).join('\n')
      : 'No user context available.';

    const systemPrompt = SYSTEM_PROMPT.replace('{{USER_CONTEXT}}', userContext);

    // Call Gemini REST API directly — no SDK dependency
    const contents: Content[] = [
      ...(history ?? []),
      { role: 'user', parts: [{ text: message }] },
    ];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('[career-coach] Gemini API error:', geminiRes.status, errBody);
      if (geminiRes.status === 429) return Response.json({ data: null, error: 'quota_exceeded' }, { status: 429 });
      if (geminiRes.status === 400) return Response.json({ data: null, error: 'invalid_api_key' }, { status: 401 });
      return Response.json({ data: null, error: 'gemini_error' }, { status: 500 });
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
      ?? 'Sorry, I could not generate a response. Please try again.';

    return Response.json({ data: { reply }, error: null });

  } catch (err) {
    console.error('[career-coach]', err instanceof Error ? err.message : err);
    return Response.json({ data: null, error: 'server_error' }, { status: 500 });
  }
}
