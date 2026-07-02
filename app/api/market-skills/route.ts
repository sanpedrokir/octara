import { requireAuth } from '@/lib/auth';
import OpenAI from 'openai';

export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface McfJob {
  title?: string;
  description?: string;
  requirements?: string;
  company?: { name?: string };
  skills?: Array<{ skill?: string }>;
}

interface McfResponse {
  total?: number;
  results?: McfJob[];
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    const { jobTitle } = await request.json() as { jobTitle: string };
    if (!jobTitle?.trim()) {
      return Response.json({ data: null, error: 'Job title is required' }, { status: 400 });
    }

    // 1. Search MyCareersFuture for live job listings
    const mcfUrl = `https://api.mycareersfuture.gov.sg/v2/jobs?search=${encodeURIComponent(jobTitle.trim())}&limit=10`;
    let jobs: McfJob[] = [];
    let totalListings = 0;

    try {
      const mcfRes = await fetch(mcfUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; OctaraBot/1.0)',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (mcfRes.ok) {
        const mcfData = await mcfRes.json() as McfResponse;
        jobs = mcfData.results ?? [];
        totalListings = mcfData.total ?? jobs.length;
      }
    } catch {
      // MCF API unreachable — fall through to AI with empty context
    }

    if (jobs.length === 0) {
      return Response.json({ data: null, error: `No job listings found for "${jobTitle}" on MyCareersFuture. Try a broader title.` });
    }

    // 2. Build combined text from all job descriptions (cap at 8 000 chars for token budget)
    const jobBlocks = jobs.map((job, i) => {
      const parts = [
        `[Job ${i + 1}] ${job.title ?? jobTitle}${job.company?.name ? ` · ${job.company.name}` : ''}`,
        job.description ?? '',
        job.requirements ?? '',
        (job.skills ?? []).map(s => s.skill).filter(Boolean).join(', '),
      ].filter(Boolean);
      return parts.join('\n');
    });

    const combinedText = jobBlocks.join('\n\n---\n\n').slice(0, 8000);

    // 3. Use AI to extract and aggregate skills across all listings
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a skill extraction expert for Singapore job market analysis.
Extract and deduplicate all required skills from job listings.
Return ONLY a valid JSON object — no markdown, no explanation — with this exact shape:
{
  "skills": [
    { "name": "string (1–5 words)", "category": "Technical" | "Tools & Platforms" | "Soft Skills" | "Domain Knowledge", "importance": "high" | "medium" | "low", "frequency": <number 1–${jobs.length}> }
  ]
}
Rules:
- Merge synonyms (e.g. "Node.js" and "NodeJS" → one entry)
- frequency = number of listings that mentioned it
- importance: high = 3+ listings, medium = 2 listings, low = 1 listing
- Return 10–25 skills, sorted by frequency desc
- Singapore context: treat "SkillsFuture", "WSG", "MOM" as Domain Knowledge`,
        },
        {
          role: 'user',
          content: `Job title searched: "${jobTitle}"\n\n${combinedText}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const raw = completion.choices[0].message.content ?? '{"skills":[]}';
    const extracted = JSON.parse(raw) as {
      skills: Array<{ name: string; category: string; importance: string; frequency: number }>;
    };

    const companies = [...new Set(
      jobs.map(j => j.company?.name).filter((n): n is string => !!n)
    )].slice(0, 5);

    return Response.json({
      data: {
        skills: extracted.skills ?? [],
        jobCount: jobs.length,
        totalListings,
        sampleCompanies: companies,
      },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch market skills';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
