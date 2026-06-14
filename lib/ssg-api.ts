import type { SsgCourse } from './types';
import { getAccessToken } from './ssg-api-auth';
import { httpsGetJson } from './https-request';
import { apexHeaders } from './apex-sign';
import { searchLocalCatalog } from './sf-catalog';

// Course Directory and Skills Framework both live on public-api.ssg-wsg.sg
const SSG_BASE = 'https://public-api.ssg-wsg.sg';
const SF_COURSE_DETAIL_URL = 'https://www.myskillsfuture.gov.sg/individual/course-directory/course-detail.html';

function buildSearchUrl(keyword: string): string {
  return `https://courses.myskillsfuture.gov.sg/search?keyword=${encodeURIComponent(keyword)}`;
}

function courseDetailUrl(refNum: string): string {
  return `${SF_COURSE_DETAIL_URL}?courseReferenceNumber=${encodeURIComponent(refNum)}`;
}

function parseCourse(c: Record<string, unknown>, fallbackKeyword = ''): SsgCourse {
  const provider = c.trainingProvider as Record<string, unknown> | undefined;
  const mode = c.modeOfTraining as Record<string, unknown> | undefined;
  const refNum = String(c.referenceNumber || c.courseReferenceNumber || '');

  return {
    referenceNumber: refNum,
    title: String(c.title || c.courseName || ''),
    providerName: String(provider?.name || c.providerName || ''),
    totalCostOfTrainingPerTrainee: Number(c.totalCostOfTrainingPerTrainee ?? c.fee ?? 0),
    subsidisedFee: Number(c.subsidisedFee ?? 0),
    url: refNum ? courseDetailUrl(refNum) : buildSearchUrl(fallbackKeyword),
    category: String(c.category ?? ''),
    modeOfTraining: String(mode?.description || c.modeOfTraining || ''),
    duration: String(c.totalTrainingDurationHour ? `${c.totalTrainingDurationHour} hrs` : c.duration || ''),
  };
}

export type CourseSource = 'live' | 'catalog' | 'mock';

export async function searchCoursesWithSource(
  keyword: string,
  page = 0
): Promise<{ courses: SsgCourse[]; source: CourseSource }> {
  try {
    const token = await getAccessToken();
    const clientId = process.env.SSG_CLIENT_ID ?? '';
    const clientSecret = process.env.SSG_CLIENT_SECRET ?? '';
    const queryParams = { keyword, page: String(page), pageSize: '10' };
    const url = `${SSG_BASE}/skillsFramework/courses?keyword=${encodeURIComponent(keyword)}&pageNo=${page}&pageSize=10`;
    const headers = apexHeaders('GET', url, token, clientId, clientSecret, queryParams);
    const result = await httpsGetJson(url, headers, 10000);

    if (!result.ok || !result.data) {
      console.error(`[SSG Course API] HTTP ${result.status} for keyword="${keyword}": ${result.error}`);
      return fallbackToLocalCatalog(keyword);
    }

    const json = result.data as Record<string, unknown>;
    const raw: unknown[] =
      (json?.data as Record<string, unknown>)?.courses as unknown[] ??
      (json?.data as Record<string, unknown>)?.data as unknown[] ??
      json?.courses as unknown[] ??
      json?.data as unknown[] ??
      [];

    if (!Array.isArray(raw) || raw.length === 0) {
      console.error(`[SSG Course API] Empty results for keyword="${keyword}". Keys: ${Object.keys(json).join(', ')}`);
      return fallbackToLocalCatalog(keyword);
    }

    return {
      courses: raw.map(c => parseCourse(c as Record<string, unknown>, keyword)),
      source: 'live',
    };
  } catch (e) {
    console.error(`[SSG Course API] Exception for keyword="${keyword}":`, e);
    return fallbackToLocalCatalog(keyword);
  }
}

function fallbackToLocalCatalog(keyword: string): { courses: SsgCourse[]; source: CourseSource } {
  const localResults = searchLocalCatalog(keyword);
  if (localResults.length > 0) {
    return { courses: localResults, source: 'catalog' };
  }
  return { courses: getMockCourses(keyword), source: 'mock' };
}

export async function searchCourses(keyword: string, page = 0): Promise<SsgCourse[]> {
  const { courses } = await searchCoursesWithSource(keyword, page);
  return courses;
}

export async function searchCoursesBySkills(skills: string[]): Promise<Record<string, SsgCourse[]>> {
  const results: Record<string, SsgCourse[]> = {};
  await Promise.all(
    skills.map(async skill => {
      results[skill] = await searchCourses(skill);
    })
  );
  return results;
}

function getMockCourses(keyword: string): SsgCourse[] {
  // No SSG API subscription — return a search-link so users land on
  // real SkillsFuture results rather than a fake course that goes nowhere.
  return [
    {
      referenceNumber: '',
      title: `Search "${keyword}" courses on SkillsFuture`,
      providerName: 'SkillsFuture Singapore',
      totalCostOfTrainingPerTrainee: 0,
      subsidisedFee: 0,
      url: buildSearchUrl(keyword),
      category: '',
      modeOfTraining: '',
    },
  ];
}
