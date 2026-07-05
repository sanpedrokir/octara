import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import * as cheerio from 'cheerio';

export const maxDuration = 60;

const BASE = 'https://www.np.edu.sg';

const SCHOOL_PATHS = [
  '/schools-courses/academic-schools/school-of-business-accountancy',
  '/schools-courses/academic-schools/school-of-design-environment',
  '/schools-courses/academic-schools/school-of-engineering',
  '/schools-courses/academic-schools/school-of-film-media-studies',
  '/schools-courses/academic-schools/school-of-health-sciences',
  '/schools-courses/academic-schools/school-of-humanities-interdisciplinary-studies',
  '/schools-courses/academic-schools/school-of-infocomm-technology',
  '/schools-courses/academic-schools/school-of-life-sciences-chemical-technology',
];

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractCourseLinks(html: string): { title: string; path: string }[] {
  const $ = cheerio.load(html);
  const courses: { title: string; path: string }[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (
      href.includes('/schools-courses/academic-schools/school-of-') &&
      href.split('/').length >= 5 &&
      !seen.has(href)
    ) {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.length > 5) {
        seen.add(href);
        courses.push({ title: text, path: href.startsWith('http') ? href : `${BASE}${href}` });
      }
    }
  });

  return courses;
}

function extractCourseDetail(html: string, fallbackTitle: string): {
  title: string;
  description: string | null;
  duration: string | null;
  skills: string[];
} {
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() || fallbackTitle;

  let description: string | null = null;
  for (const sel of ['#overview', '#about', '.course-overview', '.course-description', 'main', 'article', 'body']) {
    const paras = $(sel).find('p').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 60);
    if (paras.length > 0) { description = paras[0]; break; }
  }

  const bodyText = $('body').text();
  const durMatch = bodyText.match(/(\d[\d.]*\s*(?:year|years|month|months))/i);
  const duration = durMatch ? durMatch[1].trim() : null;

  const skills: string[] = [];
  const seen = new Set<string>();
  $('h2, h3, h4, li').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (
      text.length > 5 && text.length < 80 && !seen.has(text) &&
      /specialis|module|skill|competenc|track|major|technolog|design|management|engineering|analytics|cybersecurity|programming|network|database/i.test(text)
    ) {
      seen.add(text);
      skills.push(text);
    }
  });

  return { title, description, duration, skills: skills.slice(0, 10) };
}

// Run promises in parallel with a concurrency cap
async function parallelLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += limit) chunks.push(items.slice(i, i + limit));
  for (const chunk of chunks) await Promise.all(chunk.map(fn));
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const { institution_id, replace_all } = await request.json() as { institution_id: number; replace_all?: boolean };
    if (!institution_id) return Response.json({ data: null, error: 'institution_id required' }, { status: 400 });

    const sql = db();

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_inst_courses_url ON institution_courses(institution_id, url)`;

    if (replace_all) {
      await sql`DELETE FROM institution_courses WHERE institution_id = ${institution_id}`;
    }

    // Step 1: fetch all 8 school pages in parallel
    const schoolHtmls = await Promise.all(
      SCHOOL_PATHS.map(p => fetchHtml(`${BASE}${p}`))
    );

    const allCourseLinks: { title: string; path: string }[] = [];
    for (const html of schoolHtmls) {
      if (html) allCourseLinks.push(...extractCourseLinks(html));
    }

    // Deduplicate by URL
    const unique = [...new Map(allCourseLinks.map(c => [c.path, c])).values()];

    let inserted = 0;
    const errors: string[] = [];

    // Step 2: fetch all course detail pages in parallel batches of 6
    await parallelLimit(unique, 6, async (course) => {
      try {
        const html = await fetchHtml(course.path);
        if (!html) { errors.push(`Failed: ${course.path}`); return; }

        const { title, description, duration, skills } = extractCourseDetail(html, course.title);

        await sql`
          INSERT INTO institution_courses (institution_id, title, description, url, duration, skills_covered)
          VALUES (${institution_id}, ${title}, ${description}, ${course.path}, ${duration}, ${skills})
          ON CONFLICT (institution_id, url) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            duration = EXCLUDED.duration,
            skills_covered = EXCLUDED.skills_covered
        `;
        inserted++;
      } catch (err) {
        errors.push(`${course.path}: ${err instanceof Error ? err.message : 'error'}`);
      }
    });

    return Response.json({
      data: { inserted, total: unique.length, skipped: unique.length - inserted, errors: errors.slice(0, 10) },
      error: null,
    });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Scrape failed' }, { status: 500 });
  }
}
