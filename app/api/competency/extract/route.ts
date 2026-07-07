import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';
import { Agent, fetch as undiciFetch } from 'undici';
import { createHash } from 'crypto';

type Skill = { skill: string; proficiency: string; category: string };

async function extractFromText(openai: OpenAI, text: string, sourceLabel: string): Promise<Skill[]> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `Analyse the following ${sourceLabel} and extract ALL professional competencies, technical skills, and domain knowledge the person possesses. Be thorough — do not consolidate or skip skills.

For each competency:
- Identify the skill name (concise, 2-5 words)
- Estimate proficiency: "basic", "intermediate", "advanced", or "expert" based on context (years, seniority, achievements mentioned)
- Categorise as: "technical", "domain", "leadership", "soft", or "tool"

${sourceLabel} text:
---
${text.slice(0, 8000)}
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

  const content = res.choices[0]?.message?.content ?? '{"competencies":[]}';
  const parsed = JSON.parse(content) as { competencies: Skill[] };
  return parsed.competencies ?? [];
}

function mergeSkills(primary: Skill[], secondary: Skill[]): Skill[] {
  const seen = new Set(primary.map(s => s.skill.toLowerCase()));
  const additions = secondary.filter(s => !seen.has(s.skill.toLowerCase()));
  return [...primary, ...additions];
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const contentType = request.headers.get('content-type') ?? '';
    let resumeText = '';
    let linkedInText = '';
    let resumeFilename: string | null = null;
    let contentHash: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const text = formData.get('text') as string | null;
      const liText = formData.get('linkedInText') as string | null;
      linkedInText = liText?.trim() ?? '';

      if (text?.trim()) {
        resumeText = text.trim();
        resumeFilename = 'pasted text';
        contentHash = createHash('sha256').update(resumeText).digest('hex').slice(0, 32);
      } else if (file) {
        resumeFilename = file.name;
        if (file.name.endsWith('.pdf')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pdfParseModule: any = await import('pdf-parse/lib/pdf-parse');
          const pdfParse = pdfParseModule.default ?? pdfParseModule;
          const buffer = Buffer.from(await file.arrayBuffer());
          contentHash = createHash('sha256').update(buffer).digest('hex').slice(0, 32);
          const parsed = await pdfParse(buffer);
          resumeText = parsed.text;
        } else {
          resumeText = await file.text();
          contentHash = createHash('sha256').update(resumeText).digest('hex').slice(0, 32);
        }
      }
    } else {
      const body = await request.json() as { text?: string; linkedInText?: string };
      resumeText = body.text?.trim() ?? '';
      linkedInText = body.linkedInText?.trim() ?? '';
      if (resumeText) {
        resumeFilename = 'pasted text';
        contentHash = createHash('sha256').update(resumeText).digest('hex').slice(0, 32);
      }
    }

    if (!resumeFilename && linkedInText) resumeFilename = 'LinkedIn profile';

    if (!resumeText && !linkedInText) {
      return Response.json({ data: null, error: 'No resume text provided' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ data: null, error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const sql = db();

    // ── Ensure schema ────────────────────────────────────────────────────────
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_content_hash TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_filename TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_uploaded_at TIMESTAMPTZ`;
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

    // ── Cache hit: same file content — skip GPT, return existing results ─────
    if (contentHash) {
      const [userRow] = await sql`
        SELECT resume_content_hash FROM users WHERE id = ${session.userId}
      ` as Array<{ resume_content_hash: string | null }>;

      if (userRow?.resume_content_hash === contentHash) {
        const existing = await sql`
          SELECT skill_title, proficiency_level, category, ssg_matched, skill_code, ssg_sector
          FROM user_competencies
          WHERE user_id = ${session.userId} AND source = 'resume'
          ORDER BY skill_title
        ` as Array<{ skill_title: string; proficiency_level: string; category: string | null; ssg_matched: boolean; skill_code: string | null; ssg_sector: string | null }>;

        // Only use cache if there are actually saved competencies — avoids stale hash bug
        if (existing.length > 0) {
          const competencies: Skill[] = existing.map(r => ({
            skill: r.skill_title,
            proficiency: r.proficiency_level,
            category: r.category ?? 'domain',
          }));

          const ssgMatches: Record<string, { skill_title: string; skill_code: string | null; sector: string | null }[]> = {};
          for (const r of existing) {
            if (r.ssg_matched) {
              ssgMatches[r.skill_title] = [{ skill_title: r.skill_title, skill_code: r.skill_code, sector: r.ssg_sector }];
            }
          }

          return Response.json({ data: { competencies, ssgMatches, saved: competencies.length, cached: true }, error: null });
        }
      }
    }

    // ── Cache miss: new file — extract with GPT ──────────────────────────────
    const tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });
    const openai = new OpenAI({
      apiKey,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch: (url, init) => undiciFetch(url as string, { ...(init as any), dispatcher: tlsAgent }) as unknown as Promise<Response>,
    });

    let competencies: Skill[];
    if (resumeText && linkedInText) {
      const [cvSkills, liSkills] = await Promise.all([
        extractFromText(openai, resumeText, 'resume / CV'),
        extractFromText(openai, linkedInText, 'LinkedIn profile'),
      ]);
      competencies = mergeSkills(cvSkills, liSkills);
    } else if (resumeText) {
      competencies = await extractFromText(openai, resumeText, 'resume / CV');
    } else {
      competencies = await extractFromText(openai, linkedInText, 'LinkedIn profile');
    }

    if (competencies.length === 0) {
      return Response.json({ data: { competencies: [], ssgMatches: {} }, error: null });
    }

    // ── SSG matching (SG users only) ─────────────────────────────────────────
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'SG'`;
    const [countryRow] = await sql`SELECT COALESCE(country, 'SG') AS country FROM users WHERE id = ${session.userId}` as Array<{ country: string }>;
    const isSgUser = (countryRow?.country ?? 'SG') === 'SG';

    const ssgMatches: Record<string, { skill_title: string; skill_code: string | null; sector: string | null }[]> = {};
    if (isSgUser) {
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
    }

    // ── Persist: replace resume skills, update hash ──────────────────────────
    await sql`DELETE FROM user_competencies WHERE user_id = ${session.userId} AND source = 'resume'`;
    if (resumeFilename) {
      await sql`UPDATE users SET resume_filename = ${resumeFilename}, resume_uploaded_at = NOW(), resume_content_hash = ${contentHash} WHERE id = ${session.userId}`;
    }

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
