import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateQuizQuestions } from '@/lib/openai-client';
import type { QuizQuestion } from '@/lib/types';

/** Convert a sector_scenario_questions DB row to the QuizQuestion shape the quiz UI expects. */
function rowToQuestion(row: {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  difficulty: string | null;
}): QuizQuestion {
  return {
    q: row.question,
    opts: [
      `A. ${row.option_a}`,
      `B. ${row.option_b}`,
      `C. ${row.option_c}`,
      `D. ${row.option_d}`,
    ],
    ans: row.correct_answer,
    difficulty: (row.difficulty as QuizQuestion['difficulty']) ?? 'medium',
  };
}

/** Resolve the user's sector — try profiles first, then career aspirations. */
async function getUserSector(userId: number): Promise<string | null> {
  const sql = db();

  // 1. Profile setup sector (working_adult / other)
  try {
    const [profile] = await sql`
      SELECT current_sector FROM profiles WHERE user_id = ${userId}
    ` as Array<{ current_sector: string | null }>;
    if (profile?.current_sector) return profile.current_sector;
  } catch { /* column may not exist yet */ }

  // 2. Career goal → industry name used as sector proxy
  try {
    const [career] = await sql`
      SELECT i.name AS industry_name
      FROM career_aspirations ca
      JOIN industries i ON ca.industry_id = i.id
      WHERE ca.user_id = ${userId}
      LIMIT 1
    ` as Array<{ industry_name: string }>;
    if (career?.industry_name) return career.industry_name;
  } catch { /* table may not exist */ }

  return null;
}

/** Pick 25 random stored questions for a sector, shuffle, and return. */
async function getStoredQuestions(sector: string): Promise<QuizQuestion[] | null> {
  const sql = db();

  // Check count first — don't attempt if table is empty for this sector
  const [{ cnt }] = await sql`
    SELECT COUNT(*)::int AS cnt FROM sector_scenario_questions WHERE sector = ${sector}
  ` as Array<{ cnt: number }>;

  if (cnt < 25) return null;

  const rows = await sql`
    SELECT question, option_a, option_b, option_c, option_d, correct_answer, difficulty
    FROM sector_scenario_questions
    WHERE sector = ${sector}
    ORDER BY RANDOM()
    LIMIT 25
  ` as Array<{
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: string;
    difficulty: string | null;
  }>;

  return rows.map(rowToQuestion);
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { skill } = await request.json();
    if (!skill) return Response.json({ data: null, error: 'Skill is required' }, { status: 400 });

    // 1. Try to serve from stored sector questions (no OpenAI token used)
    try {
      const sector = await getUserSector(session.userId);
      if (sector) {
        const stored = await getStoredQuestions(sector);
        if (stored && stored.length >= 25) {
          return Response.json({ data: stored, error: null, source: 'db' });
        }
      }
    } catch { /* fall through to OpenAI */ }

    // 2. Fall back to OpenAI if no stored questions available
    const questions = await generateQuizQuestions(skill as string);
    return Response.json({ data: questions, error: null, source: 'openai' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
