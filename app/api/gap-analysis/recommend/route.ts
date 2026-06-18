import { requireAuth } from '@/lib/auth';
import { searchCoursesWithSource } from '@/lib/ssg-api';

export async function POST(request: Request) {
  try {
    await requireAuth();

    const { missingSkills } = await request.json() as {
      missingSkills: string[];
      sector: string;
      role: string;
    };

    if (!missingSkills?.length) {
      return Response.json({ data: { courses: [] }, error: null });
    }

    // Search SSG for each missing skill (up to 8 parallel searches)
    const skillsToSearch = missingSkills.slice(0, 8);
    const results = await Promise.all(
      skillsToSearch.map(skill => searchCoursesWithSource(skill))
    );

    // Deduplicate by referenceNumber/title, map to Course shape, take up to 10
    const seen = new Set<string>();
    const courses: Array<{
      title: string;
      provider: string;
      type: 'ssg';
      url: string;
      description: string;
      skills_covered: string[];
    }> = [];

    for (let i = 0; i < results.length; i++) {
      const skill = skillsToSearch[i];
      const { courses: batch } = results[i];

      for (const c of batch) {
        if (courses.length >= 10) break;
        const key = c.referenceNumber || c.title;
        if (seen.has(key)) continue;
        seen.add(key);

        const descParts: string[] = [];
        if (c.modeOfTraining) descParts.push(c.modeOfTraining);
        if (c.duration) descParts.push(c.duration);
        if ((c.subsidisedFee ?? 0) > 0) {
          descParts.push(`From S$${c.subsidisedFee} (subsidised)`);
        } else if ((c.totalCostOfTrainingPerTrainee ?? -1) === 0) {
          descParts.push('Free');
        } else if ((c.totalCostOfTrainingPerTrainee ?? 0) > 0) {
          descParts.push(`S$${c.totalCostOfTrainingPerTrainee}`);
        }

        courses.push({
          title: c.title,
          provider: c.providerName || 'SkillsFuture Singapore',
          type: 'ssg',
          url: c.url,
          description: descParts.join(' · ') || 'SSG-accredited course aligned to the Skills Framework.',
          skills_covered: [skill],
        });
      }
    }

    return Response.json({ data: { courses }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Recommendation failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
