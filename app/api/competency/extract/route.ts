import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';
import { Agent, fetch as undiciFetch } from 'undici';

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const contentType = request.headers.get('content-type') ?? '';
    let resumeText = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const text = formData.get('text') as string | null;

      if (text?.trim()) {
        resumeText = text.trim();
      } else if (file) {
        if (file.name.endsWith('.pdf')) {
          // Import the lib directly to skip the debug-mode test-file load in index.js
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pdfParseModule: any = await import('pdf-parse/lib/pdf-parse');
          const pdfParse = pdfParseModule.default ?? pdfParseModule;
          const buffer = Buffer.from(await file.arrayBuffer());
          const parsed = await pdfParse(buffer);
          resumeText = parsed.text;
        } else {
          // .txt or other text-based files
          resumeText = await file.text();
        }
      }
    } else {
      const body = await request.json() as { text?: string };
      resumeText = body.text?.trim() ?? '';
    }

    if (!resumeText) {
      return Response.json({ data: null, error: 'No resume text provided' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ data: null, error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Use undici directly with rejectUnauthorized:false to bypass Windows CRL check
    const tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });
    const openai = new OpenAI({
      apiKey,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch: (url, init) => undiciFetch(url as string, { ...(init as any), dispatcher: tlsAgent }) as unknown as Promise<Response>,
    });

    // Extract competencies from resume text
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Analyse the following resume and extract all professional competencies, technical skills, and domain knowledge the person possesses.

For each competency:
- Identify the skill name (concise, 2-5 words)
- Estimate proficiency: "basic", "intermediate", "advanced", or "expert" based on context (years, seniority, achievements mentioned)
- Categorise as: "technical", "domain", "leadership", "soft", or "tool"

Resume text:
---
${resumeText.slice(0, 6000)}
---

Return JSON:
{
  "competencies": [
    { "skill": "Python Programming", "proficiency": "advanced", "category": "technical" },
    { "skill": "Financial Analysis", "proficiency": "intermediate", "category": "domain" }
  ]
}`,
      }],
    });

    const content = aiRes.choices[0]?.message?.content ?? '{"competencies":[]}';
    const parsed = JSON.parse(content) as { competencies: Array<{ skill: string; proficiency: string; category: string }> };
    const competencies = parsed.competencies ?? [];

    if (competencies.length === 0) {
      return Response.json({ data: { competencies: [], ssgMatches: {} }, error: null });
    }

    // Match each competency against SSG Skills Framework in DB
    const sql = db();
    const ssgMatches: Record<string, { skill_title: string; skill_code: string | null; sector: string | null }[]> = {};

    for (const c of competencies) {
      const keyword = c.skill.replace(/[%_]/g, '');
      const rows = await sql`
        SELECT DISTINCT skill_title, skill_code, updated_sector_tagging AS sector
        FROM jobs_skills_mapping
        WHERE skill_title ILIKE ${'%' + keyword + '%'}
           OR updated_skill_title ILIKE ${'%' + keyword + '%'}
        LIMIT 3
      ` as Array<{ skill_title: string; skill_code: string | null; sector: string | null }>;
      if (rows.length > 0) ssgMatches[c.skill] = rows;
    }

    // Auto-save all extracted competencies to user_competencies (replace previous resume ones)
    await sql`
      CREATE TABLE IF NOT EXISTS user_competencies (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_title       TEXT NOT NULL,
        skill_code        TEXT,
        proficiency_level TEXT NOT NULL DEFAULT 'intermediate',
        category          TEXT,
        source            TEXT NOT NULL DEFAULT 'manual',
        ssg_matched       BOOLEAN NOT NULL DEFAULT false,
        ssg_sector        TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, skill_title)
      )
    `;
    await sql`DELETE FROM user_competencies WHERE user_id = ${session.userId} AND source = 'resume'`;

    for (const c of competencies) {
      const ssgMatch = ssgMatches[c.skill]?.[0] ?? null;
      const skillTitle = ssgMatch ? ssgMatch.skill_title : c.skill;
      const skillCode  = ssgMatch?.skill_code ?? null;
      const ssgSector  = ssgMatch?.sector ?? null;
      const ssgMatched = ssgMatch !== null;
      const proficiency = ['basic', 'intermediate', 'advanced', 'expert'].includes(c.proficiency)
        ? c.proficiency : 'intermediate';

      await sql`
        INSERT INTO user_competencies
          (user_id, skill_title, skill_code, proficiency_level, category, source, ssg_matched, ssg_sector)
        VALUES
          (${session.userId}, ${skillTitle}, ${skillCode}, ${proficiency},
           ${c.category ?? null}, 'resume', ${ssgMatched}, ${ssgSector})
        ON CONFLICT (user_id, skill_title) DO UPDATE SET
          proficiency_level = EXCLUDED.proficiency_level,
          skill_code        = COALESCE(EXCLUDED.skill_code, user_competencies.skill_code),
          ssg_matched       = EXCLUDED.ssg_matched OR user_competencies.ssg_matched,
          ssg_sector        = COALESCE(EXCLUDED.ssg_sector, user_competencies.ssg_sector)
      `;
    }

    return Response.json({ data: { competencies, ssgMatches, saved: competencies.length }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Extraction failed';
    const cause = err instanceof Error ? (err as NodeJS.ErrnoException).cause : undefined;
    console.error('[competency/extract] error:', msg, '| cause:', cause);
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
