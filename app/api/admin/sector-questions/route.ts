import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

const BATCH_SIZE = 25;
const TARGET = 1000;

const FOCUS_AREAS = [
  'customer complaints, service recovery and de-escalation',
  'vendor negotiation and procurement decisions',
  'employee performance reviews and managing underperformers',
  'budget overruns, cost-cutting and financial accountability',
  'product or service launch delays and stakeholder communication',
  'data breach response and cybersecurity incident handling',
  'new market entry, competitor response and strategic positioning',
  'team conflict, cross-departmental disputes and mediation',
  'regulatory audit preparation and compliance remediation',
  'leadership succession planning and talent pipeline development',
  'pricing strategy, discounting pressure and margin management',
  'customer retention, churn prevention and loyalty programmes',
  'digital transformation roadmap and legacy system migration',
  'supply chain disruption, alternative sourcing and logistics',
  'merger or acquisition integration and cultural alignment',
  'ESG commitments, sustainability reporting and green operations',
  'fraud detection, internal financial controls and whistleblowing',
  'crisis PR, brand reputation damage and media response',
  'remote and hybrid work policies and distributed team management',
  'innovation pipeline prioritisation and R&D investment decisions',
  'contract disputes, legal risk management and liability',
  'diversity, equity and inclusion initiatives and bias in hiring',
  'capacity planning, resource allocation and headcount decisions',
  'customer analytics, segmentation and data-driven strategy',
  'quality control failures, product recalls and corrective action',
  'board presentations, governance reporting and executive communication',
  'strategic partnerships, joint ventures and alliance management',
  'employee well-being, burnout prevention and mental health at work',
  'outsourcing versus insourcing analysis and vendor risk',
  'change management during large-scale organisational restructuring',
  'ethical dilemmas in leadership and conflicts of interest',
  'KPI setting, performance dashboard interpretation and target revision',
  'new technology adoption resistance and digital upskilling',
  'business continuity planning and disaster recovery scenarios',
  'cross-border operations, international compliance and cultural sensitivity',
  'mentoring, coaching and giving difficult feedback',
  'profit margin analysis, business unit review and strategic divestiture',
  'competitive intelligence gathering and strategic response planning',
  'customer experience transformation and journey redesign',
  'crisis leadership, decision-making under uncertainty and resilience',
];

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS sector_scenario_questions (
      id             SERIAL PRIMARY KEY,
      sector         TEXT NOT NULL,
      question       TEXT NOT NULL,
      option_a       TEXT NOT NULL,
      option_b       TEXT NOT NULL,
      option_c       TEXT NOT NULL,
      option_d       TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation    TEXT,
      difficulty     TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ssq_sector ON sector_scenario_questions(sector)`;
}

export async function GET() {
  try {
    const session = await requireAuth();
    if (session.role !== 'admin') return Response.json({ data: null, error: 'Forbidden' }, { status: 403 });

    await ensureTable();
    const sql = db();

    const sectors = await sql`
      SELECT DISTINCT sector FROM job_role_catalog
      WHERE sector IS NOT NULL AND sector != ''
      ORDER BY sector
    `;

    const counts = await sql`
      SELECT sector, COUNT(*)::int AS count
      FROM sector_scenario_questions
      GROUP BY sector
    `;

    const countMap: Record<string, number> = {};
    for (const row of counts as Array<{ sector: string; count: number }>) {
      countMap[row.sector] = row.count;
    }

    const data = (sectors as Array<{ sector: string }>).map(r => ({
      sector: r.sector,
      count: countMap[r.sector] ?? 0,
      target: TARGET,
      complete: (countMap[r.sector] ?? 0) >= TARGET,
    }));

    return Response.json({ data, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    if (session.role !== 'admin') return Response.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const body = await request.json() as { sector?: string; batchIndex?: number };
    const sector = body.sector?.trim();
    const batchIndex = body.batchIndex ?? 0;

    if (!sector) return Response.json({ data: null, error: 'sector is required' }, { status: 400 });

    // Check OpenAI key first so we get a clear error instead of a cryptic 500
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ data: null, error: 'OPENAI_API_KEY is not set in environment variables' }, { status: 500 });
    }

    await ensureTable();
    const sql = db();

    // Check current count — skip if sector is already complete
    const countRows = await sql`
      SELECT COUNT(*)::int AS count FROM sector_scenario_questions WHERE sector = ${sector}
    `;
    const currentCount = (countRows[0] as { count: number }).count;

    if (currentCount >= TARGET) {
      return Response.json({ data: { inserted: 0, total: currentCount, skipped: true }, error: null });
    }

    // Generate via OpenAI
    const openai = new OpenAI({ apiKey });
    const focus = FOCUS_AREAS[batchIndex % FOCUS_AREAS.length];

    const prompt = `You are an expert corporate trainer for the ${sector} sector in Singapore.

Generate exactly ${BATCH_SIZE} unique multiple-choice scenario questions about: "${focus}" specifically in the context of the ${sector} industry.

Rules:
- Each question must describe a realistic workplace scenario a ${sector} professional would face
- Questions must be specific to ${sector} — not generic management theory
- No two questions should cover the same scenario
- Each question must have exactly 4 options (A–D) where only ONE is clearly the best answer
- Mix difficulties: approximately 8 easy, 9 medium, 8 hard

Return ONLY valid JSON with this exact structure (no extra text, no markdown):
{
  "questions": [
    {
      "q": "full scenario question text",
      "a": "option A text (no A. prefix)",
      "b": "option B text (no B. prefix)",
      "c": "option C text (no C. prefix)",
      "d": "option D text (no D. prefix)",
      "ans": "A",
      "explanation": "why this answer is correct in 1-2 sentences",
      "difficulty": "easy"
    }
  ]
}`;

    let aiContent: string;
    try {
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 6000,
        temperature: 0.85,
      });
      aiContent = res.choices[0]?.message?.content ?? '';
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : 'OpenAI request failed';
      return Response.json({ data: null, error: `OpenAI error: ${msg}` }, { status: 500 });
    }

    if (!aiContent) {
      return Response.json({ data: null, error: 'OpenAI returned an empty response' }, { status: 500 });
    }

    let parsed: { questions?: Array<{ q: string; a: string; b: string; c: string; d: string; ans: string; explanation?: string; difficulty?: string }> };
    try {
      parsed = JSON.parse(aiContent);
    } catch {
      return Response.json({ data: null, error: 'OpenAI returned malformed JSON' }, { status: 500 });
    }

    const questions = (parsed.questions ?? []).slice(0, BATCH_SIZE);
    if (questions.length === 0) {
      return Response.json({ data: null, error: 'OpenAI returned no questions in the expected format' }, { status: 500 });
    }

    // Insert questions, skipping any with invalid answer keys
    let inserted = 0;
    for (const q of questions) {
      try {
        const ans = (q.ans ?? '').toUpperCase().trim().charAt(0);
        if (!['A', 'B', 'C', 'D'].includes(ans)) continue;
        const diff = ['easy', 'medium', 'hard'].includes(q.difficulty ?? '') ? q.difficulty! : 'medium';
        const questionText = (q.q ?? '').trim();
        const optA = (q.a ?? '').trim();
        const optB = (q.b ?? '').trim();
        const optC = (q.c ?? '').trim();
        const optD = (q.d ?? '').trim();
        if (!questionText || !optA || !optB || !optC || !optD) continue;

        await sql`
          INSERT INTO sector_scenario_questions
            (sector, question, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty)
          VALUES
            (${sector}, ${questionText}, ${optA}, ${optB}, ${optC}, ${optD}, ${ans}, ${q.explanation ?? null}, ${diff})
        `;
        inserted++;
      } catch {
        // Skip individual bad rows rather than failing the whole batch
      }
    }

    const totalRows = await sql`
      SELECT COUNT(*)::int AS total FROM sector_scenario_questions WHERE sector = ${sector}
    `;
    const total = (totalRows[0] as { total: number }).total;

    return Response.json({ data: { inserted, total, skipped: false }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
