import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    await requireAuth();

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
          // Dynamic import avoids Next.js build-time issues; cast needed for ESM types
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pdfParseModule: any = await import('pdf-parse');
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

    const openai = new OpenAI({ apiKey });

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

    return Response.json({ data: { competencies, ssgMatches }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Extraction failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
