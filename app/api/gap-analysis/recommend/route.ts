import { requireAuth } from '@/lib/auth';
import OpenAI from 'openai';

export interface RecommendedCourse {
  title: string;
  provider: string;
  type: 'ssg' | 'youtube' | 'mooc' | 'online';
  url: string;
  description: string;
  skills_covered: string[];
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    const { missingSkills, sector, role } = await request.json() as {
      missingSkills: string[];
      sector: string;
      role: string;
    };

    if (!missingSkills?.length) {
      return Response.json({ data: { courses: [] }, error: null });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ data: null, error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    const skillsText = missingSkills.slice(0, 20).join(', ');

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `You are a career development advisor in Singapore. A learner is targeting the role of "${role || 'professional'}" in the "${sector}" sector and has these competency gaps: ${skillsText}.

Recommend exactly 10 learning resources. Mix the types:
- 3-4 SSG/SkillsFuture approved courses (type: "ssg")
- 3 free YouTube resources (type: "youtube")
- 3 MOOCs (Coursera, edX, LinkedIn Learning free - type: "mooc")

Rules:
- For SSG: URL must be https://www.myskillsfuture.gov.sg/content/portal/en/training-exchange/course-landing.html (real portal)
- For YouTube: URL format https://www.youtube.com/results?search_query=... (real searchable query)
- For MOOCs: use real platform URLs (coursera.org, edx.org, linkedin.com/learning)
- skills_covered: pick 1-3 skills from the gap list that this course addresses
- Make course titles specific and realistic

Return JSON:
{
  "courses": [
    {
      "title": "Python for Data Analytics",
      "provider": "SkillsFuture Singapore",
      "type": "ssg",
      "url": "https://www.myskillsfuture.gov.sg/...",
      "description": "Hands-on course covering Python fundamentals and data manipulation with pandas.",
      "skills_covered": ["Python Programming", "Data Analytics"]
    }
  ]
}`,
      }],
    });

    const content = res.choices[0]?.message?.content ?? '{"courses":[]}';
    let parsed: { courses: RecommendedCourse[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { courses: [] };
    }

    return Response.json({ data: { courses: parsed.courses ?? [] }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Recommendation failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
