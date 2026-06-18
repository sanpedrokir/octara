import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import RecommendedCourses from '@/app/ui/RecommendedCourses';
import Leaderboard from '@/app/ui/Leaderboard';

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/login');

  const sql = db();

  const userRows = await sql`SELECT name FROM users WHERE id = ${session.userId}`;
  const user = userRows[0] as { name: string } | undefined;
  const careerRows = await sql`
    SELECT i.name as industry_name, jr.name as job_role_name
    FROM career_aspirations ca
    LEFT JOIN industries i ON ca.industry_id = i.id
    LEFT JOIN job_roles jr ON ca.job_role_id = jr.id
    WHERE ca.user_id = ${session.userId}
  `;
  const career = careerRows[0] as { industry_name: string; job_role_name: string } | undefined;
  const courseStatsRows = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress
    FROM tracked_courses
    WHERE user_id = ${session.userId}
  `;
  const courseStats = courseStatsRows[0] as { total: string; completed: string; in_progress: string } | undefined;
  const roadmapCountRows = await sql`SELECT COUNT(*) as count FROM learning_roadmaps WHERE user_id = ${session.userId}`;
  const roadmapCount = roadmapCountRows[0] as { count: string } | undefined;
  const profileRows = await sql`SELECT bio, location FROM profiles WHERE user_id = ${session.userId}`;
  const profileData = profileRows[0] as { bio: string | null; location: string | null } | undefined;

  // Certifications & Training counts
  let certCount = 0;
  let trainingCount = 0;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_certifications (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
        category TEXT NOT NULL, title TEXT NOT NULL,
        organisation TEXT, date_obtained DATE, expiry_date DATE,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    const credRows = await sql`
      SELECT category, COUNT(*)::int AS cnt
      FROM user_certifications WHERE user_id = ${session.userId}
      GROUP BY category
    `;
    for (const row of credRows as Array<{ category: string; cnt: number }>) {
      if (row.category === 'certification') certCount = row.cnt;
      if (row.category === 'training') trainingCount = row.cnt;
    }
  } catch { /* table may not exist yet on first deploy */ }


  // Progress computation — try skill_assessments first, fall back to learning_roadmaps
  const assessmentRows = await sql`
    SELECT skill_gaps, strengths, current_skills FROM skill_assessments
    WHERE user_id = ${session.userId}
    ORDER BY created_at DESC LIMIT 1
  `;
  let rawSkillGaps = (assessmentRows[0]?.skill_gaps ?? null) as Array<{ skill: string; priority: string }> | null;

  if (!rawSkillGaps || rawSkillGaps.length === 0) {
    const roadmapRows = await sql`
      SELECT skill_gaps FROM learning_roadmaps
      WHERE user_id = ${session.userId}
      ORDER BY created_at DESC LIMIT 1
    `;
    rawSkillGaps = (roadmapRows[0]?.skill_gaps ?? null) as Array<{ skill: string; priority: string }> | null;
  }

  const skillGaps: Array<{ skill: string; priority: string }> = rawSkillGaps ?? [];
  const totalGaps = skillGaps.length;
  const hasAssessment = rawSkillGaps !== null && totalGaps > 0;

  const trackedWithSkill = await sql`
    SELECT skill_name, status FROM tracked_courses
    WHERE user_id = ${session.userId} AND skill_name IS NOT NULL AND skill_name != ''
  ` as Array<{ skill_name: string; status: string }>;

  const gapNames = new Set(skillGaps.map(g => g.skill.toLowerCase()));
  const coveredByCompleted = new Set(
    trackedWithSkill.filter(c => c.status === 'completed' && gapNames.has(c.skill_name.toLowerCase())).map(c => c.skill_name.toLowerCase())
  );
  const coveredByInProgress = new Set(
    trackedWithSkill.filter(c => c.status === 'in_progress' && gapNames.has(c.skill_name.toLowerCase())).map(c => c.skill_name.toLowerCase())
  );

  const totalTracked = Number(courseStats?.total ?? 0);
  const totalCompleted = Number(courseStats?.completed ?? 0);

  // Weighted progress score (out of 100)
  // 15 pts: milestones (career goal + assessment done)
  // 55 pts: skill gaps covered (completed=full, in-progress=half)
  // 30 pts: overall course completion rate
  let progressScore = 0;
  if (career) progressScore += 8;
  if (hasAssessment) progressScore += 7;
  if (totalGaps > 0) {
    progressScore += Math.round((coveredByCompleted.size / totalGaps) * 55);
    progressScore += Math.round((coveredByInProgress.size / totalGaps) * 27);
  }
  if (totalTracked > 0) {
    progressScore += Math.round((totalCompleted / totalTracked) * 30);
  }
  progressScore = Math.min(100, progressScore);

  const progressLabel =
    progressScore === 0 ? 'Not started'
    : progressScore < 25 ? 'Just getting started'
    : progressScore < 50 ? 'Building momentum'
    : progressScore < 75 ? 'Making great progress'
    : progressScore < 100 ? 'Almost there!'
    : 'Goal achieved!';

  const progressColor =
    progressScore < 25 ? 'var(--muted)'
    : progressScore < 50 ? 'var(--warning)'
    : progressScore < 75 ? 'var(--primary)'
    : 'var(--teal)';

  const profileComplete = !!(profileData?.bio && profileData?.location);
  const hasCareer = !!career;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          {greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Here&apos;s your career journey overview.</p>
      </div>

      {/* Setup checklist if incomplete */}
      {(!hasCareer || !profileComplete) && (
        <div className="card p-5" style={{ border: '2px solid var(--primary)', background: 'var(--primary-light)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--primary)' }}>🚀 Complete your setup</h2>
          <div className="space-y-2">
            {!profileComplete && (
              <div className="flex items-center gap-2 text-sm">
                <span>⬜</span>
                <Link href="/profile" className="font-medium no-underline" style={{ color: 'var(--primary)' }}>Complete your profile</Link>
                <span style={{ color: 'var(--muted)' }}>– add bio and location</span>
              </div>
            )}
            {!hasCareer && (
              <div className="flex items-center gap-2 text-sm">
                <span>⬜</span>
                <Link href="/career" className="font-medium no-underline" style={{ color: 'var(--primary)' }}>Set your career goal</Link>
                <span style={{ color: 'var(--muted)' }}>– choose your target industry and role</span>
              </div>
            )}
            {hasCareer && !hasAssessment && (
              <div className="flex items-center gap-2 text-sm">
                <span>⬜</span>
                <Link href="/skills-navigator" className="font-medium no-underline" style={{ color: 'var(--primary)' }}>Run skills analysis</Link>
                <span style={{ color: 'var(--muted)' }}>– get your personalised roadmap</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="card p-4">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Track Recommended Courses</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Courses Tracked', value: courseStats?.total ?? '0', icon: '📚', color: 'var(--primary)', bg: 'var(--primary-light)' },
          { label: 'Completed', value: courseStats?.completed ?? '0', icon: '✅', color: 'var(--teal)', bg: '#f0fdfa' },
          { label: 'In Progress', value: courseStats?.in_progress ?? '0', icon: '⏳', color: 'var(--warning)', bg: '#fffbeb' },
          { label: 'Roadmaps', value: roadmapCount?.count ?? '0', icon: '🗺️', color: '#7c3aed', bg: '#f5f3ff' },
        ].map(stat => (
          <div key={stat.label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: stat.bg }}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{String(stat.value)}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>

      {/* Certifications & Training */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>🏆 Certifications & Training</h2>
          <Link href="/certifications" className="text-xs font-medium no-underline" style={{ color: 'var(--primary)' }}>
            {certCount + trainingCount > 0 ? 'View all →' : 'Add entries →'}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#fefce8', border: '1px solid #fde68a' }}>
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#92400e' }}>{certCount}</p>
              <p className="text-xs font-medium" style={{ color: '#92400e' }}>Certification{certCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#ede9fe', border: '1px solid #c4b5fd' }}>
            <span className="text-2xl">📖</span>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#5b21b6' }}>{trainingCount}</p>
              <p className="text-xs font-medium" style={{ color: '#5b21b6' }}>Training{trainingCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        {certCount + trainingCount === 0 && (
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Add your certifications and training records to track your credentials.
          </p>
        )}
      </div>

      {/* Career Progress */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>📈 Career Readiness Progress</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {career ? `Towards ${career.job_role_name} · ${career.industry_name}` : 'Set a career goal to track your progress'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-3xl font-bold" style={{ color: progressColor }}>{progressScore}%</span>
            <p className="text-xs mt-0.5 font-medium" style={{ color: progressColor }}>{progressLabel}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full rounded-full h-3 mb-4" style={{ background: 'var(--muted-bg)' }}>
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{ width: `${progressScore}%`, background: progressColor }}
          />
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Milestones */}
          <div className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Setup</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span>{career ? '✅' : '⬜'}</span>
                <span style={{ color: career ? 'var(--foreground)' : 'var(--muted)' }}>Career goal set</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span>{hasAssessment ? '✅' : '⬜'}</span>
                <span style={{ color: hasAssessment ? 'var(--foreground)' : 'var(--muted)' }}>Skill gap analysis done</span>
              </div>
            </div>
          </div>

          {/* Skill gaps */}
          <div className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Skill Gaps Covered</p>
            {totalGaps > 0 ? (
              <>
                <p className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                  {coveredByCompleted.size + coveredByInProgress.size}
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--muted)' }}>/ {totalGaps}</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {coveredByCompleted.size} completed · {coveredByInProgress.size} in progress
                </p>
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Run skill analysis first</p>
            )}
          </div>

          {/* Course completion */}
          <div className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Courses Completed</p>
            {totalTracked > 0 ? (
              <>
                <p className="text-lg font-bold" style={{ color: 'var(--teal)' }}>
                  {totalCompleted}
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--muted)' }}>/ {totalTracked}</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {totalTracked - totalCompleted} still in progress
                </p>
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>No courses tracked yet</p>
            )}
          </div>
        </div>

        {progressScore < 100 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
            <Link href="/skills-navigator" className="text-xs font-medium no-underline" style={{ color: 'var(--primary)' }}>
              {!hasAssessment ? '→ Run skill gap analysis to unlock full progress tracking' : '→ Go to Skills Navigator to continue your learning journey'}
            </Link>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <Leaderboard />

      {/* Recommended courses based on career goal */}
      {hasCareer && <RecommendedCourses />}

    </div>
  );
}
