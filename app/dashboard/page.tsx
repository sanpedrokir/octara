import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import RecommendedCourses from '@/app/ui/RecommendedCourses';
import Leaderboard from '@/app/ui/Leaderboard';

const SECTIONS = [
  {
    href: '/career',
    icon: '🎯',
    label: 'Career Goal',
    description: 'Set your target industry and job role.',
    color: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe',
  },
  {
    href: '/competency',
    icon: '🧩',
    label: 'Competency Profile',
    description: 'Upload your resume and manage your skills.',
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
  },
  {
    href: '/gap-analysis',
    icon: '📊',
    label: 'Gap Analysis',
    description: 'See your skill gaps and get course recommendations.',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
  {
    href: '/certifications',
    icon: '🏆',
    label: 'My Credentials',
    description: 'Track certifications and training records.',
    color: '#b45309',
    bg: '#fefce8',
    border: '#fde68a',
  },
  {
    href: '/skill-quiz',
    icon: '🧠',
    label: 'Work Knowledge Quiz',
    description: 'Test your work knowledge, move up the Leaderboard!',
    color: '#15803d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  {
    href: '/profile',
    icon: '👤',
    label: 'My Profile',
    description: 'Update your bio, location and personal details.',
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
];

const MUTED_SECTIONS = [
  { href: '/skills-navigator', icon: '🧭', label: 'Skills Navigator', description: 'AI-powered personalised learning roadmap.' },
  { href: '/my-courses',       icon: '📚', label: 'My Courses',        description: 'Track and manage your enrolled courses.' },
];

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/login');

  const sql = db();

  const userRows = await sql`SELECT name FROM users WHERE id = ${session.userId}`;
  const user = userRows[0] as { name: string } | undefined;
  const firstName = user?.name?.split(' ')[0] || 'there';

  const careerRows = await sql`
    SELECT i.name as industry_name, jr.name as job_role_name
    FROM career_aspirations ca
    LEFT JOIN industries i ON ca.industry_id = i.id
    LEFT JOIN job_roles jr ON ca.job_role_id = jr.id
    WHERE ca.user_id = ${session.userId}
  `;
  const careerRaw = careerRows[0] as { industry_name: string | null; job_role_name: string | null } | undefined;
  const career = (careerRaw?.industry_name && careerRaw?.job_role_name) ? careerRaw as { industry_name: string; job_role_name: string } : undefined;

  const courseStatsRows = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress
    FROM tracked_courses WHERE user_id = ${session.userId}
  `;
  const courseStats = courseStatsRows[0] as { total: string; completed: string; in_progress: string } | undefined;

  const profileRows = await sql`SELECT bio, location, phone FROM profiles WHERE user_id = ${session.userId}`;
  const profileData = profileRows[0] as { bio: string | null; location: string | null; phone: string | null } | undefined;

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
      FROM user_certifications WHERE user_id = ${session.userId} GROUP BY category
    `;
    for (const row of credRows as Array<{ category: string; cnt: number }>) {
      if (row.category === 'certification') certCount = row.cnt;
      if (row.category === 'training')     trainingCount = row.cnt;
    }
  } catch { /* first deploy */ }

  const assessmentRows = await sql`
    SELECT skill_gaps FROM skill_assessments
    WHERE user_id = ${session.userId} ORDER BY created_at DESC LIMIT 1
  `;
  let rawSkillGaps = (assessmentRows[0]?.skill_gaps ?? null) as Array<{ skill: string; priority: string }> | null;
  if (!rawSkillGaps || rawSkillGaps.length === 0) {
    const roadmapRows = await sql`
      SELECT skill_gaps FROM learning_roadmaps
      WHERE user_id = ${session.userId} ORDER BY created_at DESC LIMIT 1
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

  let progressScore = 0;
  if (career) progressScore += 8;
  if (hasAssessment) progressScore += 7;
  if (totalGaps > 0) {
    progressScore += Math.round((coveredByCompleted.size / totalGaps) * 55);
    progressScore += Math.round((coveredByInProgress.size / totalGaps) * 27);
  }
  if (totalTracked > 0) progressScore += Math.round((totalCompleted / totalTracked) * 30);
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

  // Profile is complete if the user has a name (set at registration) plus any one additional field,
  // OR if any profile field has been saved — avoids false "incomplete" nags after sign-up.
  const profileComplete = !!(user?.name && (profileData?.bio || profileData?.location || profileData?.phone || profileData));
  // hasCareer = true as soon as any career_aspirations row exists for the user,
  // regardless of whether the JOIN resolved names (avoids banner sticking after goal is saved).
  const hasCareer = careerRows.length > 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-10 animate-fade-in">

      {/* ── HEADER ───────────────────────────────────────────── */}
      <div className="text-center pt-4">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
          {greeting()}, {firstName} 👋
        </h1>
        <p className="mt-2 text-base" style={{ color: 'var(--muted)' }}>
          Where would you like to go today?
        </p>
      </div>

      {/* ── SETUP CHECKLIST ──────────────────────────────────── */}
      {(!hasCareer || !profileComplete) && (
        <div className="card p-5 max-w-2xl mx-auto w-full" style={{ border: '2px solid var(--primary)', background: 'var(--primary-light)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--primary)' }}>🚀 Complete your setup</h2>
          <div className="space-y-2">
            {!profileComplete && (
              <div className="flex items-center gap-2 text-sm">
                <span>⬜</span>
                <Link href="/profile" className="font-medium no-underline" style={{ color: 'var(--primary)' }}>Complete your profile</Link>
                <span style={{ color: 'var(--muted)' }}>– add basic profile details</span>
              </div>
            )}
            {!hasCareer && (
              <div className="flex items-center gap-2 text-sm">
                <span>⬜</span>
                <Link href="/career" className="font-medium no-underline" style={{ color: 'var(--primary)' }}>Set your career goal</Link>
                <span style={{ color: 'var(--muted)' }}>– choose your target industry and role</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION CARDS ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href} className="no-underline group">
            <div
              className="h-full rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200 group-hover:shadow-lg group-hover:-translate-y-0.5"
              style={{ background: s.bg, border: `1.5px solid ${s.border}` }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{ background: 'white', boxShadow: `0 2px 8px ${s.border}` }}
              >
                {s.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold mb-1.5" style={{ color: s.color }}>{s.label}</h2>
                <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>{s.description}</p>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-sm font-semibold transition-transform duration-200 group-hover:translate-x-1" style={{ color: s.color }}>
                  Go →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── COMING SOON ──────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: 'var(--muted)' }}>
          Coming soon
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MUTED_SECTIONS.map(s => (
            <div key={s.href} className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: 'var(--muted-bg)', border: '1.5px solid var(--card-border)', opacity: 0.6 }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: 'var(--background)' }}>
                {s.icon}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{s.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DIVIDER ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t" style={{ borderColor: 'var(--card-border)' }} />
        <span className="text-xs font-semibold uppercase tracking-widest px-2" style={{ color: 'var(--muted)' }}>Your Progress</span>
        <div className="flex-1 border-t" style={{ borderColor: 'var(--card-border)' }} />
      </div>

      {/* ── CAREER READINESS PROGRESS ────────────────────────── */}
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
        <div className="w-full rounded-full h-3 mb-4" style={{ background: 'var(--muted-bg)' }}>
          <div className="h-3 rounded-full transition-all duration-700" style={{ width: `${progressScore}%`, background: progressColor }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <div className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Courses Completed</p>
            {totalTracked > 0 ? (
              <>
                <p className="text-lg font-bold" style={{ color: 'var(--teal)' }}>
                  {totalCompleted}
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--muted)' }}>/ {totalTracked}</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{totalTracked - totalCompleted} still in progress</p>
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

      {/* ── CERTIFICATIONS & TRAINING ────────────────────────── */}
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

      {/* ── LEADERBOARD ──────────────────────────────────────── */}
      <Leaderboard />

      {/* ── RECOMMENDED COURSES ──────────────────────────────── */}
      {hasCareer && <RecommendedCourses />}

    </div>
  );
}
