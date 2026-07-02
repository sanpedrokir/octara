import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { searchCoursesWithSource } from '@/lib/ssg-api';

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
      : getCuratedMooc(row.sector ?? '', row.role ?? '', []);
    return Response.json({ data: { courses: row.courses, youtube: row.youtube, mooc, sector: row.sector, role: row.role }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function fetchYouTubeVideo(courseTitle: string, skill: string): Promise<YouTubeVideo> {
  const query = `${courseTitle} ${skill} tutorial`.trim();
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const apiKey = process.env.YOUTUBE_API_KEY;

  const fallback: YouTubeVideo = {
    courseTitle, videoId: '', title: query,
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

// Curated fallback courses used when Coursera API is unreachable
function getCuratedMooc(sector: string, role: string, skills: string[]): MoocCourse[] {
  const keyword = (role || sector || skills[0] || '').toLowerCase();
  const base: MoocCourse[] = [
    { title: 'Learning How to Learn', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/learning-how-to-learn', description: 'Powerful mental tools to help you master tough subjects · approx. 15 hours', skills_covered: [skills[0] ?? sector] },
    { title: 'The Science of Well-Being', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/the-science-of-well-being', description: 'Yale\'s most popular course on happiness and productivity · approx. 19 hours', skills_covered: [skills[1] ?? sector] },
    { title: 'Project Management Principles', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/project-management-foundations', description: 'Foundations of project management for professionals · approx. 17 hours', skills_covered: [skills[2] ?? sector] },
    { title: 'Introduction to Data Analytics', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/introduction-to-data-analytics', description: 'IBM – data analytics fundamentals and tools · approx. 14 hours', skills_covered: [skills[3] ?? sector] },
    { title: 'Business Communication Skills', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/wharton-communication-skills', description: 'Wharton – communication for career advancement · approx. 10 hours', skills_covered: [skills[4] ?? sector] },
  ];

  if (/tech|software|digital|infocomm|ict|data|cyber|ai|cloud/i.test(keyword)) {
    return [
      { title: 'Google IT Support', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/professional-certificates/google-it-support', description: 'Google – IT fundamentals for the modern workplace · approx. 6 months', skills_covered: [skills[0] ?? sector] },
      { title: 'IBM Data Science', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/professional-certificates/ibm-data-science', description: 'IBM – data science professional certificate · approx. 10 months', skills_covered: [skills[1] ?? sector] },
      { title: 'Deep Learning Specialization', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/specializations/deep-learning', description: 'DeepLearning.AI – neural networks and deep learning · approx. 5 months', skills_covered: [skills[2] ?? sector] },
      { title: 'Cloud Computing Fundamentals', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/cloud-computing', description: 'Illinois – distributed systems and cloud architectures · approx. 20 hours', skills_covered: [skills[3] ?? sector] },
      { title: 'Cybersecurity Fundamentals', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/intro-cyber-security', description: 'NYU – introduction to cybersecurity · approx. 10 hours', skills_covered: [skills[4] ?? sector] },
    ];
  }
  if (/finance|banking|accounting|insurance/i.test(keyword)) {
    return [
      { title: 'Financial Markets', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/financial-markets-global', description: 'Yale (Robert Shiller) – overview of financial markets · approx. 33 hours', skills_covered: [skills[0] ?? sector] },
      { title: 'Introduction to Corporate Finance', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/wharton-corporate-finance', description: 'Wharton – corporate finance fundamentals · approx. 16 hours', skills_covered: [skills[1] ?? sector] },
      { title: 'FinTech: Finance Industry Transformation', provider: 'Coursera', type: 'mooc', url: 'https://www.coursera.org/learn/hong-kong-fintech', description: 'HKU – FinTech trends and digital banking · approx. 10 hours', skills_covered: [skills[2] ?? sector] },
      ...base.slice(2),
    ];
  }
  return base;
}

async function fetchCourseraCourses(queries: string[], sector: string, role: string, skills: string[]): Promise<MoocCourse[]> {
  const batches = await Promise.all(queries.slice(0, 4).map(q => fetchCourseraForQuery(q)));
  const seen = new Set<string>();
  const results: MoocCourse[] = [];
  for (const batch of batches) {
    for (const c of batch) {
      if (seen.has(c.url) || results.length >= 15) continue;
      seen.add(c.url);
      results.push(c);
    }
  }
  // If Coursera API returned nothing, use curated fallback
  if (results.length === 0) {
    return getCuratedMooc(sector, role, skills);
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

    const moocQueries = [role.trim(), sector.trim(), ...missingSkills.slice(0, 3)].filter(Boolean);
    const youtube: Record<string, YouTubeVideo> = {};

    if (isEsco) {
      // ── ESCO path: no SSG courses; YouTube keyed to MOOC titles ──────────
      const mooc = await fetchCourseraCourses(moocQueries, sector, role, missingSkills);
      const ytList = await Promise.all(mooc.slice(0, 8).map(c => fetchYouTubeVideo(c.title, c.skills_covered[0] ?? '')));
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
    const ssgResults = await Promise.all(skillsToSearch.map(s => searchCoursesWithSource(s)));

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

    const [youtubeList, mooc] = await Promise.all([
      Promise.all(courses.map(c => fetchYouTubeVideo(c.title, c.skills_covered[0] ?? ''))),
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
