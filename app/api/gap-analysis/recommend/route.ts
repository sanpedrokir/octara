import { requireAuth } from '@/lib/auth';
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
    const res = await fetch(url);
    if (!res.ok) return fallback;
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

async function fetchCourseraCourses(queries: string[]): Promise<MoocCourse[]> {
  const seen = new Set<string>();
  const results: MoocCourse[] = [];

  for (const query of queries) {
    if (results.length >= 20) break;
    try {
      const apiUrl = `https://api.coursera.org/api/courses.v1?q=search&query=${encodeURIComponent(query)}&limit=8&fields=name,slug,shortDescription,workload`;
      const res = await fetch(apiUrl);
      if (!res.ok) continue;
      const data = await res.json() as {
        elements?: Array<{
          id: string;
          name: string;
          slug: string;
          shortDescription?: string;
          workload?: string;
        }>;
      };
      for (const c of data.elements ?? []) {
        if (seen.has(c.slug)) continue;
        seen.add(c.slug);
        const rawDesc = c.shortDescription ?? '';
        const desc = rawDesc.length > 140 ? rawDesc.slice(0, 137) + '…' : rawDesc || 'Coursera course relevant to your career goal.';
        results.push({
          title: c.name,
          provider: 'Coursera',
          type: 'mooc',
          url: `https://www.coursera.org/learn/${c.slug}`,
          description: desc + (c.workload ? ` · ${c.workload}` : ''),
          skills_covered: [query],
        });
      }
    } catch {
      // skip failed query, continue with next
    }
  }

  return results;
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    const body = await request.json() as { missingSkills: string[]; sector: string; role: string };
    const { missingSkills, sector = '', role = '' } = body;

    if (!missingSkills?.length) {
      return Response.json({ data: { courses: [], youtube: [], mooc: [] }, error: null });
    }

    // ── 1. SSG courses ───────────────────────────────────────────────────
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

    // ── 2. YouTube — one video per SSG course (parallel) ─────────────────
    const youtube = await Promise.all(
      courses.map(c => fetchYouTubeVideo(c.title, c.skills_covered[0] ?? ''))
    );

    // ── 3. MOOC — Coursera by role + sector + top skills ─────────────────
    const moocQueries = [
      role.trim(),
      sector.trim(),
      ...missingSkills.slice(0, 5),
    ].filter(Boolean);

    const mooc = await fetchCourseraCourses(moocQueries);

    return Response.json({ data: { courses, youtube, mooc }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Recommendation failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
