import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 60;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── ProxyCurl types ───────────────────────────────────────────────────────────
interface DatePart { year?: number; month?: number }
interface ProxyCurlProfile {
  full_name?: string;
  headline?: string;
  summary?: string;
  city?: string;
  country?: string;
  connections?: number;
  experiences?: Array<{
    title?: string;
    company?: string;
    description?: string;
    starts_at?: DatePart;
    ends_at?: DatePart | null;
  }>;
  education?: Array<{
    school?: string;
    degree_name?: string;
    field_of_study?: string;
    starts_at?: DatePart;
    ends_at?: DatePart;
  }>;
  skills?: string[];
  certifications?: Array<{ name?: string; authority?: string }>;
  recommendations?: unknown[];
  error?: string;
}

// ── Convert ProxyCurl JSON → readable text for GPT ──────────────────────────
function proxycurlToText(p: ProxyCurlProfile): string {
  const lines: string[] = [];

  if (p.full_name) lines.push(`Name: ${p.full_name}`);
  if (p.headline)  lines.push(`Headline: ${p.headline}`);
  if (p.city || p.country) lines.push(`Location: ${[p.city, p.country].filter(Boolean).join(', ')}`);
  if (p.connections) lines.push(`Connections: ${p.connections}+`);
  if (p.summary)   lines.push(`\nAbout:\n${p.summary}`);

  if (p.experiences?.length) {
    lines.push('\nExperience:');
    for (const e of p.experiences.slice(0, 6)) {
      const start = e.starts_at?.year ?? '';
      const end   = e.ends_at?.year  ?? 'Present';
      lines.push(`- ${e.title ?? ''} at ${e.company ?? ''} (${start}–${end})`);
      if (e.description) lines.push(`  ${e.description.slice(0, 300)}`);
    }
  }

  if (p.education?.length) {
    lines.push('\nEducation:');
    for (const e of p.education.slice(0, 3)) {
      const deg = [e.degree_name, e.field_of_study].filter(Boolean).join(' in ');
      lines.push(`- ${deg} at ${e.school ?? ''} (${e.starts_at?.year ?? ''}–${e.ends_at?.year ?? ''})`);
    }
  }

  if (p.skills?.length) {
    lines.push(`\nSkills: ${p.skills.slice(0, 40).join(', ')}`);
  }

  if (p.certifications?.length) {
    lines.push('\nCertifications:');
    for (const c of p.certifications.slice(0, 5)) {
      lines.push(`- ${c.name ?? ''} (${c.authority ?? ''})`);
    }
  }

  if (p.recommendations?.length) {
    lines.push(`\nRecommendations: ${p.recommendations.length}`);
  }

  return lines.join('\n');
}

// ── Fetch LinkedIn profile via ProxyCurl ─────────────────────────────────────
async function fetchViaProxyCurl(linkedinUrl: string): Promise<{ text: string; error?: string }> {
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) return { text: '', error: 'PROXYCURL_NOT_CONFIGURED' };

  const endpoint = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}&use_cache=if-present&skills=include&infer_salary=skip&personal_contact_number=exclude&personal_email=exclude`;

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000),
    });

    if (res.status === 404) return { text: '', error: 'LinkedIn profile not found. Check the URL is a public profile.' };
    if (res.status === 401) return { text: '', error: 'ProxyCurl API key is invalid.' };
    if (res.status === 429) return { text: '', error: 'ProxyCurl rate limit reached. Try again in a moment.' };
    if (!res.ok) return { text: '', error: `ProxyCurl error (${res.status}). Try pasting your profile text instead.` };

    const profile = await res.json() as ProxyCurlProfile;
    if (profile.error) return { text: '', error: profile.error };

    const text = proxycurlToText(profile);
    if (text.length < 50) return { text: '', error: 'Profile appears to be private or empty. Try a public profile URL.' };

    return { text };
  } catch {
    return { text: '', error: 'Could not reach ProxyCurl. Check your connection or paste the profile text manually.' };
  }
}

// ── Score with GPT ────────────────────────────────────────────────────────────
async function scoreProfile(profileText: string, targetRole: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a LinkedIn profile optimisation expert for Singapore professionals. Score and give actionable rewrites. Return ONLY valid JSON.',
      },
      {
        role: 'user',
        content: `Score this LinkedIn profile for someone targeting: ${targetRole}

PROFILE TEXT:
${profileText.slice(0, 4000)}

Return JSON:
{
  "overall_score": <0-100 integer>,
  "grade": "A/B/C/D/F",
  "sections": {
    "headline":     { "score": <0-20>, "feedback": "...", "rewrite": "suggested headline (max 120 chars)" },
    "summary":      { "score": <0-25>, "feedback": "...", "rewrite": "suggested summary (3-4 sentences)" },
    "skills":       { "score": <0-20>, "feedback": "...", "missing_skills": ["skill1", "skill2", "skill3"] },
    "experience":   { "score": <0-25>, "feedback": "...", "tip": "one actionable improvement" },
    "completeness": { "score": <0-10>, "feedback": "...", "missing": ["photo", "recommendations", etc] }
  },
  "top_3_actions": ["action 1", "action 2", "action 3"],
  "keywords_to_add": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });
  return JSON.parse(completion.choices[0].message.content ?? '{}');
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json() as { profileText?: string; linkedinUrl?: string };
    const { profileText, linkedinUrl } = body;

    let textToScore = '';
    let source: 'url' | 'manual' = 'manual';

    if (linkedinUrl?.trim()) {
      // URL path — fetch via ProxyCurl
      const { text, error } = await fetchViaProxyCurl(linkedinUrl.trim());
      if (error === 'PROXYCURL_NOT_CONFIGURED') {
        return Response.json({ data: null, error: 'LinkedIn URL fetching is not configured yet. Please paste your profile text instead.' }, { status: 503 });
      }
      if (error) {
        return Response.json({ data: null, error }, { status: 400 });
      }
      textToScore = text;
      source = 'url';
    } else if (profileText?.trim()) {
      // Manual paste fallback
      if (profileText.trim().length < 50) {
        return Response.json({ data: null, error: 'Please paste at least 50 characters of your LinkedIn profile.' }, { status: 400 });
      }
      textToScore = profileText.trim();
    } else {
      return Response.json({ data: null, error: 'Please enter a LinkedIn URL or paste your profile text.' }, { status: 400 });
    }

    const sql = db();
    const [career] = await sql`
      SELECT COALESCE(jr.name, jrc.job_role, ej.occupation_title) AS role,
             COALESCE(i.name, jrc.sector, ej.isco_group) AS sector
      FROM career_aspirations ca
      LEFT JOIN industries i ON ca.industry_id = i.id
      LEFT JOIN job_roles jr ON ca.job_role_id = jr.id
      LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
      LEFT JOIN esco_job_catalog ej ON ca.esco_occupation_id = ej.id
      WHERE ca.user_id = ${session.userId}
    ` as Array<{ role: string | null; sector: string | null }>;

    const targetRole = career?.role || career?.sector || 'your target role';
    const result = await scoreProfile(textToScore, targetRole);

    return Response.json({ data: { ...result, targetRole, source }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Scoring failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
