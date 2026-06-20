import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
If a user asks anything NOT related to career advice (e.g. cooking, sports, relationships unrelated to work, coding help for personal projects, general knowledge questions, math problems, creative writing, etc.), respond with:
"I'm Cora, your career coach here on Octara. I can only help with career-related questions — things like job search, skill development, career planning, and workplace challenges. What career question can I help you with today?"

TONE & STYLE:
- Warm, encouraging, and professional
- Use clear and concise language — avoid jargon unless explaining it
- Ask clarifying questions when needed to give personalised advice
- Be specific and actionable — give concrete next steps
- When relevant, reference Singapore context: SkillsFuture, NTUC, WSG (Workforce Singapore), MOM guidelines
- Keep responses focused — no need to be exhaustive, be helpful and direct

USER CONTEXT (if provided):
{{USER_CONTEXT}}

Always start by acknowledging the user's situation before giving advice. If no career context is known, ask what they are currently doing and what their career goal is.`;

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ data: null, error: 'Career Coach is not configured yet.' }, { status: 503 });
    }

    // Fetch user context to personalise the coach
    const sql = db();
    const rows = await sql`
      SELECT
        u.name,
        i.name        AS industry_name,
        jr.name       AS job_role_name,
        jrc.job_role  AS catalog_role,
        jrc.sector    AS catalog_sector
      FROM users u
      LEFT JOIN career_aspirations ca  ON ca.user_id = u.id
      LEFT JOIN industries i           ON ca.industry_id = i.id
      LEFT JOIN job_roles jr           ON ca.job_role_id = jr.id
      LEFT JOIN job_role_catalog jrc   ON ca.catalog_job_role_id = jrc.id
      WHERE u.id = ${session.userId}
      LIMIT 1
    ` as Array<{
      name: string;
      industry_name: string | null;
      job_role_name: string | null;
      catalog_role: string | null;
      catalog_sector: string | null;
    }>;

    const user = rows[0];
    const jobRole = user?.catalog_role || user?.job_role_name || null;
    const industry = user?.catalog_sector || user?.industry_name || null;

    const userContext = user
      ? [
          `User's name: ${user.name}`,
          jobRole   ? `Career goal / target role: ${jobRole}` : null,
          industry  ? `Target industry / sector: ${industry}` : null,
          (!jobRole && !industry) ? 'User has not set a career goal yet.' : null,
        ].filter(Boolean).join('\n')
      : 'No user context available.';

    const systemPrompt = SYSTEM_PROMPT.replace('{{USER_CONTEXT}}', userContext);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    });

    // gemini-pro doesn't support systemInstruction — prime via a hidden first exchange
    const primedHistory = [
      {
        role: 'user' as const,
        parts: [{ text: `[SYSTEM INSTRUCTIONS — follow these strictly for the entire conversation]\n\n${systemPrompt}\n\nConfirm you understand.` }],
      },
      {
        role: 'model' as const,
        parts: [{ text: "Understood! I'm Cora, your AI Career Coach on Octara. I'll only answer career-related questions — career planning, job search, skill development, workplace challenges, and more. I'll politely decline anything off-topic. How can I help with your career today?" }],
      },
      ...(history ?? []),
    ];

    const chat = model.startChat({ history: primedHistory });
    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    return Response.json({ data: { reply }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
