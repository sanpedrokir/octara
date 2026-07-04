import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

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

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { message, history } = await request.json() as {
      message: string;
      history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    };

    if (!message?.trim()) {
      return Response.json({ data: null, error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ data: null, error: 'Career Coach is not configured yet.' }, { status: 503 });
    }

    // Fetch user context — covers SSG catalog, legacy job_roles, and ESCO catalog
    const sql = db();
    const rows = await sql`
      SELECT u.name,
        COALESCE(jrc.job_role, jr.name, ej.occupation_title) AS job_role_name,
        COALESCE(jrc.sector, i.name, ej.isco_group)          AS industry_name
      FROM users u
      LEFT JOIN career_aspirations ca  ON ca.user_id = u.id
      LEFT JOIN industries i           ON ca.industry_id = i.id
      LEFT JOIN job_roles jr           ON ca.job_role_id = jr.id
      LEFT JOIN job_role_catalog jrc   ON ca.catalog_job_role_id = jrc.id
      LEFT JOIN esco_job_catalog ej    ON ca.esco_occupation_id = ej.id
      WHERE u.id = ${session.userId}
      LIMIT 1
    ` as Array<{ name: string; job_role_name: string | null; industry_name: string | null }>;

    const user = rows[0];
    const jobRole = user?.job_role_name || null;
    const industry = user?.industry_name || null;
    const userContext = user
      ? [
          `User's name: ${user.name}`,
          jobRole  ? `Career goal / target role: ${jobRole}` : null,
          industry ? `Target industry / sector: ${industry}` : null,
          (!jobRole && !industry) ? 'User has not set a career goal yet.' : null,
        ].filter(Boolean).join('\n')
      : 'No user context available.';

    const systemPrompt = SYSTEM_PROMPT.replace('{{USER_CONTEXT}}', userContext);

    // Convert Gemini-format history to OpenAI format
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(history ?? []).map(m => ({
        role: m.role === 'model' ? 'assistant' as const : 'user' as const,
        content: m.parts.map(p => p.text).join(''),
      })),
      { role: 'user', content: message },
    ];

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content ?? 'Sorry, I could not generate a response. Please try again.';
    return Response.json({ data: { reply }, error: null });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[career-coach]', msg);
    const status = msg.includes('429') ? 429 : msg.includes('401') ? 401 : 500;
    return Response.json({ data: null, error: msg }, { status });
  }
}
