import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { searchCoursesWithSource } from '@/lib/ssg-api';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface YouTubeVideo {
  courseTitle: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  watchUrl: string;
}

export interface MoocCourse {
  title: string;
  provider: string;
  type: 'mooc';
  url: string;
  description: string;
  skills_covered: string[];
  _trackId?: number;
  _status?: 'tracked' | 'completed';
}

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS course_recommendations (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      courses    JSONB NOT NULL DEFAULT '[]',
      youtube    JSONB NOT NULL DEFAULT '{}',
      mooc       JSONB NOT NULL DEFAULT '[]',
      sector     TEXT,
      role       TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    )
  `;
}

// ── GET: return saved recommendations ────────────────────────────────────────
export async function GET() {
  try {
    const session = await requireAuth();
    await ensureTable();
    const sql = db();
    const rows = await sql`
      SELECT courses, youtube, mooc, sector, role FROM course_recommendations
      WHERE user_id = ${session.userId}
    ` as Array<{ courses: object; youtube: object; mooc: MoocCourse[]; sector: string | null; role: string | null }>;

    if (!rows.length) return Response.json({ data: null, error: null });
    const row = rows[0];
    const mooc: MoocCourse[] = (row.mooc as MoocCourse[])?.length
      ? row.mooc as MoocCourse[]
      : await getCuratedMooc(row.sector ?? '', row.role ?? '', []);
    return Response.json({ data: { courses: row.courses, youtube: row.youtube, mooc, sector: row.sector, role: row.role }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Stop words to ignore when checking title relevance
const STOP_WORDS = new Set([
  'and','the','of','in','to','for','a','an','across','through','with','by',
  'at','from','on','as','its','or','is','are','be','been','into','via',
  'per','up','out','over','under','about','that','this','these','those',
]);

// Returns true if the course title contains at least one meaningful word from the skill name.
// Prevents arts/music courses appearing for social service skills because they happen
// to mention "collaborative" or "across disciplines" in their descriptions.
function titleMatchesSkill(courseTitle: string, skillName: string): boolean {
  const skillWords = skillName.toLowerCase()
    .split(/[\s\-\/,.()+&]+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
  if (skillWords.length === 0) return true;
  const title = courseTitle.toLowerCase();
  return skillWords.some(w => title.includes(w));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function fetchYouTubeVideo(courseTitle: string, skill: string): Promise<YouTubeVideo> {
  // Use skill name as search term — more YouTube-friendly than a verbose SSG course title
  const searchTerm = (skill || courseTitle).trim();
  const query = `${searchTerm} tutorial`;
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
  const apiKey = process.env.YOUTUBE_API_KEY;

  const fallback: YouTubeVideo = {
    courseTitle, videoId: '', title: searchTerm,
    channelTitle: 'YouTube', thumbnailUrl: '', watchUrl: searchUrl,
  };

  if (!apiKey) return fallback;

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${apiKey}&relevanceLanguage=en&order=relevance&videoDuration=medium`;
    const res = await withTimeout(fetch(url), 5000, null as unknown as Response);
    if (!res || !res.ok) return fallback;
    const data = await res.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { medium?: { url: string }; default?: { url: string } };
        };
      }>;
    };
    const item = data.items?.[0];
    if (!item) return fallback;
    return {
      courseTitle,
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? '',
      watchUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    };
  } catch {
    return fallback;
  }
}

async function fetchCourseraForQuery(query: string): Promise<MoocCourse[]> {
  try {
    const apiUrl = `https://api.coursera.org/api/courses.v1?q=search&query=${encodeURIComponent(query)}&limit=5&fields=name,slug,shortDescription,workload`;
    const fetchPromise = fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EduBot/1.0)',
        'Accept': 'application/json',
      },
    });
    const res = await withTimeout(fetchPromise, 10000, null as unknown as Response);
    if (!res || !res.ok) return [];
    const data = await res.json() as {
      elements?: Array<{ id: string; name: string; slug: string; shortDescription?: string; workload?: string }>;
    };
    return (data.elements ?? []).map(c => {
      const rawDesc = c.shortDescription ?? '';
      const desc = rawDesc.length > 140 ? rawDesc.slice(0, 137) + '…' : rawDesc || 'Coursera course relevant to your career goal.';
      return {
        title: c.name,
        provider: 'Coursera',
        type: 'mooc' as const,
        url: `https://www.coursera.org/learn/${c.slug}`,
        description: desc + (c.workload ? ` · ${c.workload}` : ''),
        skills_covered: [query],
      };
    });
  } catch {
    return [];
  }
}

// AI-powered fallback: generates role-specific MOOC suggestions when Coursera API returns nothing
async function getCuratedMooc(sector: string, role: string, skills: string[]): Promise<MoocCourse[]> {
  try {
    const target = role || sector || 'professional development';
    const skillList = skills.slice(0, 5).join(', ') || target;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a learning expert. Suggest real Coursera courses. Return ONLY valid JSON.' },
        {
          role: 'user',
          content: `Suggest 5 Coursera courses relevant to someone training to be a ${target} needing to learn: ${skillList}.
Return JSON:
{ "courses": [
  { "title": "exact Coursera course title", "slug": "coursera-url-slug", "provider": "university or company name", "description": "one sentence description · approx X hours", "skill": "which skill from the list this covers" }
] }
Use real, existing Coursera courses with accurate slugs (used in coursera.org/learn/<slug>).`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}') as {
      courses: Array<{ title: string; slug: string; provider: string; description: string; skill: string }>;
    };
    return (parsed.courses ?? []).map(c => ({
      title: c.title,
      provider: c.provider || 'Coursera',
      type: 'mooc' as const,
      // Use search URL instead of /learn/<slug> — AI-generated slugs frequently 404
      url: `https://www.coursera.org/search?query=${encodeURIComponent(c.title)}`,
      description: c.description,
      skills_covered: [c.skill],
    }));
  } catch {
    return [];
  }
}

async function fetchCourseraCourses(queries: string[], sector: string, role: string, skills: string[]): Promise<MoocCourse[]> {
  const batches = await Promise.all(queries.slice(0, 6).map(q => fetchCourseraForQuery(q)));
  const seen = new Set<string>();
  const results: MoocCourse[] = [];
  for (const batch of batches) {
    for (const c of batch) {
      if (seen.has(c.url) || results.length >= 15) continue;
      seen.add(c.url);
      results.push(c);
    }
  }
  // If Coursera API returned nothing, use AI-generated role-specific fallback
  if (results.length === 0) {
    return await getCuratedMooc(sector, role, skills);
  }
  return results;
}

// ── POST: generate and save recommendations ───────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await ensureTable();
    const sql = db();

    const body = await request.json() as { missingSkills: string[]; sector: string; role: string; isEsco?: boolean };
    const { missingSkills, sector = '', role = '', isEsco = false } = body;

    if (!missingSkills?.length) {
      return Response.json({ data: { courses: [], youtube: {}, mooc: [] }, error: null });
    }

    // Sector as first query (returns real Coursera courses reliably).
    // Skill names truncated to 3 words — full SSG names are too jargon-specific
    // for Coursera's catalog and cause the AI fallback to generate fake slugs.
    const moocQueries = [
      sector.trim(),
      ...missingSkills.slice(0, 5).map(s => s.split(/\s+/).slice(0, 3).join(' ')),
    ].filter(Boolean);
    const youtube: Record<string, YouTubeVideo> = {};

    if (isEsco) {
      // ── ESCO path: no SSG courses; YouTube keyed to MOOC titles ──────────
      const mooc = await fetchCourseraCourses(moocQueries, sector, role, missingSkills);
      // One YouTube video per unique skill gap
      const escoSkills = [...new Set(mooc.map(c => c.skills_covered[0]).filter(Boolean))].slice(0, 8);
      const ytList = await Promise.all(escoSkills.map(skill => fetchYouTubeVideo(skill, skill)));
      for (const v of ytList) youtube[v.courseTitle] = v;

      await sql`
        INSERT INTO course_recommendations (user_id, courses, youtube, mooc, sector, role)
        VALUES (${session.userId}, ${JSON.stringify([])}, ${JSON.stringify(youtube)}, ${JSON.stringify(mooc)}, ${sector}, ${role})
        ON CONFLICT (user_id)
        DO UPDATE SET
          courses    = EXCLUDED.courses,
          youtube    = EXCLUDED.youtube,
          mooc       = EXCLUDED.mooc,
          sector     = EXCLUDED.sector,
          role       = EXCLUDED.role,
          created_at = NOW()
      `;
      return Response.json({ data: { courses: [], youtube, mooc }, error: null });
    }

    // ── SSG path (SG users) ────────────────────────────────────────────────
    const skillsToSearch = missingSkills.slice(0, 8);
    const ssgResults = await Promise.all(
      skillsToSearch.map(s => searchCoursesWithSource(s))
    );

    const seenSsg = new Set<string>();
    const courses: Array<{
      title: string; provider: string; type: 'ssg';
      url: string; description: string; skills_covered: string[];
    }> = [];

    for (let i = 0; i < ssgResults.length; i++) {
      const skill = skillsToSearch[i];
      for (const c of ssgResults[i].courses) {
        if (courses.length >= 10) break;
        const key = c.referenceNumber || c.title;
        if (seenSsg.has(key)) continue;
        // Skip courses whose title has no meaningful overlap with the skill name
        if (!titleMatchesSkill(c.title, skill)) continue;
        seenSsg.add(key);

        const parts: string[] = [];
        if (c.modeOfTraining) parts.push(c.modeOfTraining);
        if (c.duration) parts.push(c.duration);
        if ((c.subsidisedFee ?? 0) > 0) parts.push(`From S$${c.subsidisedFee} (subsidised)`);
        else if ((c.totalCostOfTrainingPerTrainee ?? -1) === 0) parts.push('Free');
        else if ((c.totalCostOfTrainingPerTrainee ?? 0) > 0) parts.push(`S$${c.totalCostOfTrainingPerTrainee}`);

        courses.push({
          title: c.title,
          provider: c.providerName || 'SkillsFuture Singapore',
          type: 'ssg',
          url: c.url ?? '',
          description: parts.join(' · ') || 'SSG-accredited course aligned to the Skills Framework.',
          skills_covered: [skill],
        });
      }
    }

    // One YouTube video per unique skill gap (not per SSG course) to avoid duplicates
    const uniqueSkillsForYt = [...new Set(courses.map(c => c.skills_covered[0]).filter(Boolean))];
    const [youtubeList, mooc] = await Promise.all([
      Promise.all(uniqueSkillsForYt.map(skill => fetchYouTubeVideo(skill, skill))),
      fetchCourseraCourses(moocQueries, sector, role, missingSkills),
    ]);
    for (const v of youtubeList) youtube[v.courseTitle] = v;

    await sql`
      INSERT INTO course_recommendations (user_id, courses, youtube, mooc, sector, role)
      VALUES (${session.userId}, ${JSON.stringify(courses)}, ${JSON.stringify(youtube)}, ${JSON.stringify(mooc)}, ${sector}, ${role})
      ON CONFLICT (user_id)
      DO UPDATE SET
        courses    = EXCLUDED.courses,
        youtube    = EXCLUDED.youtube,
        mooc       = EXCLUDED.mooc,
        sector     = EXCLUDED.sector,
        role       = EXCLUDED.role,
        created_at = NOW()
    `;

    return Response.json({ data: { courses, youtube, mooc }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Recommendation failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
