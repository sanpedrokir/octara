import { searchCoursesWithSource } from '@/lib/ssg-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get('keyword') || '').trim();

  if (!keyword) {
    return Response.json({ data: [], source: 'mock', error: null });
  }

  const { courses, source } = await searchCoursesWithSource(keyword);
  return Response.json({ data: courses.slice(0, 6), source, error: null });
}
