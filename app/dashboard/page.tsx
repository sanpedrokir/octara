import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
const SECTIONS = [
  {
    href: '/career-coach',
    icon: '🎓',
    label: 'Career Coach',
    description: 'Chat with Cora, your AI career advisor, for personalised guidance.',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
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
    href: '/skill-quiz',
    icon: '🧠',
    label: 'Work Knowledge Quiz',
    description: 'Test your work scenario knowledge and move up the Leaderboard!',
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

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/login');

  const sql = db();

  const userRows = await sql`SELECT name, role FROM users WHERE id = ${session.userId}`;
  const user = userRows[0] as { name: string; role: string } | undefined;
  const isAdmin = user?.role === 'admin';
  const firstName = user?.name?.split(' ')[0] || 'there';

  const careerRows = await sql`
    SELECT
      i.name    AS industry_name,
      COALESCE(jr.name, jrc.job_role) AS job_role_name,
      COALESCE(i.name, jrc.sector)    AS career_sector,
      COALESCE(jr.name, jrc.job_role) AS role_name,
      COALESCE(i.name, jrc.sector)    AS sector_name
    FROM career_aspirations ca
    LEFT JOIN industries       i   ON ca.industry_id         = i.id
    LEFT JOIN job_roles        jr  ON ca.job_role_id         = jr.id
    LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
    WHERE ca.user_id = ${session.userId}
  `;
  const careerRaw = careerRows[0] as { industry_name: string | null; job_role_name: string | null; career_sector: string | null; role_name: string | null; sector_name: string | null } | undefined;
  const career = (careerRaw?.career_sector && careerRaw?.job_role_name) ? careerRaw as { industry_name: string | null; job_role_name: string; career_sector: string; role_name: string | null; sector_name: string | null } : undefined;
  const careerSector = careerRaw?.career_sector ?? '';
  const careerRoleName   = careerRaw?.role_name ?? '';
  const careerSectorName = careerRaw?.sector_name ?? '';


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

  // Competency profile stats
  const competencyRows = await sql`
    SELECT COUNT(*)::int AS total FROM user_competencies WHERE user_id = ${session.userId}
  `;
  const competencyCount = (competencyRows[0] as { total: number } | undefined)?.total ?? 0;
  const hasCompetencyProfile = competencyCount > 0;

  // Gap analysis matched/required counts for progress %
  let gapRequired = 0;
  let gapMatched = 0;
  if (careerRoleName && careerSectorName && hasCompetencyProfile) {
    try {
      const gapRows = await sql`
        WITH required AS (
          SELECT DISTINCT LOWER(TRIM(skill_title)) AS skill
          FROM job_role_tsc_ccs
          WHERE LOWER(TRIM(job_role)) = LOWER(TRIM(${careerRoleName}))
            AND (sector = ${careerSectorName} OR sector = 'Unknown' OR sector IS NULL)
        ),
        matched_competency AS (
          SELECT DISTINCT LOWER(TRIM(skill_title)) AS skill
          FROM user_competencies
          WHERE user_id = ${session.userId}
            AND LOWER(TRIM(skill_title)) IN (SELECT skill FROM required)
        ),
        matched_assessment AS (
          SELECT DISTINCT LOWER(TRIM(skill_title)) AS skill
          FROM competency_assessments
          WHERE user_id = ${session.userId}
            AND score >= 2
            AND LOWER(TRIM(skill_title)) IN (SELECT skill FROM required)
        ),
        matched_course AS (
          SELECT DISTINCT LOWER(TRIM(skill_name)) AS skill
          FROM tracked_courses
          WHERE user_id = ${session.userId}
            AND status = 'completed'
            AND skill_name IS NOT NULL
            AND LOWER(TRIM(skill_name)) IN (SELECT skill FROM required)
        ),
        all_matched AS (
          SELECT skill FROM matched_competency
          UNION SELECT skill FROM matched_assessment
          UNION SELECT skill FROM matched_course
        )
        SELECT
          (SELECT COUNT(*) FROM required)::int    AS required_count,
          (SELECT COUNT(*) FROM all_matched)::int AS matched_count
      `;
      const gapRow = gapRows[0] as { required_count: number; matched_count: number } | undefined;
      gapRequired = gapRow?.required_count ?? 0;
      gapMatched  = gapRow?.matched_count  ?? 0;
    } catch { /* table may not exist */ }
  }

  // Progress score: matched skills / required skills (from gap analysis)
  let progressScore = 0;
  if (gapRequired > 0) {
    progressScore = Math.round((gapMatched / gapRequired) * 100);
  } else if (hasCompetencyProfile) {
    progressScore = 10; // has profile but no gap data yet
  }
  progressScore = Math.min(100, progressScore);

  const progressLabel =
    progressScore === 0  ? 'Not started'
    : progressScore < 20 ? 'Just getting started'
    : progressScore < 40 ? 'Building momentum'
    : progressScore < 60 ? 'Making great progress'
    : progressScore < 80 ? 'Almost there!'
    : progressScore < 100 ? 'Strong performance!'
    : 'Goal achieved!';

  const progressColor =
    progressScore < 25 ? 'var(--muted)'
    : progressScore < 50 ? 'var(--warning)'
    : progressScore < 75 ? 'var(--primary)'
    : 'var(--teal)';

  const profileComplete = !!(user?.name && (profileData?.bio || profileData?.location || profileData?.phone || profileData));
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

        {/* Admin card — only for admin users */}
        {isAdmin && (
          <Link href="/admin" className="no-underline group">
            <div
              className="h-full rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200 group-hover:shadow-lg group-hover:-translate-y-0.5"
              style={{ background: '#faf5ff', border: '1.5px solid #ddd6fe' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{ background: 'white', boxShadow: '0 2px 8px #ddd6fe' }}
              >
                ⚙️
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold mb-1.5" style={{ color: '#7c3aed' }}>Admin Panel</h2>
                <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>Manage sectors, job roles, TSC/CCS data and platform settings.</p>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-sm font-semibold transition-transform duration-200 group-hover:translate-x-1" style={{ color: '#7c3aed' }}>
                  Go →
                </span>
              </div>
            </div>
          </Link>
        )}
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
              {career ? `Towards ${career.job_role_name} · ${career.career_sector}` : 'Set a career goal to track your progress'}
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
                <span>{hasCompetencyProfile ? '✅' : '⬜'}</span>
                <span style={{ color: hasCompetencyProfile ? 'var(--foreground)' : 'var(--muted)' }}>Competency profile started</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Competency Skills</p>
            {hasCompetencyProfile ? (
              <>
                <p className="text-lg font-bold" style={{ color: 'var(--primary)' }}>{competencyCount}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>skills in your profile</p>
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                <Link href="/competency" className="no-underline" style={{ color: 'var(--primary)' }}>Upload resume</Link> to start
              </p>
            )}
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Skills Matched</p>
            {gapRequired > 0 ? (
              <>
                <p className="text-lg font-bold" style={{ color: 'var(--teal)' }}>
                  {gapMatched}
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--muted)' }}>/ {gapRequired} required</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{gapRequired - gapMatched} still to close</p>
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {hasCompetencyProfile
                  ? <Link href="/gap-analysis" className="no-underline" style={{ color: 'var(--primary)' }}>View gap analysis</Link>
                  : 'Upload resume to see gaps'}
              </p>
            )}
          </div>
        </div>
        {progressScore < 100 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
            <Link href="/gap-analysis" className="text-xs font-medium no-underline" style={{ color: 'var(--primary)' }}>
              → View your Gap Analysis to see which skills to build next
            </Link>
          </div>
        )}
      </div>


      {/* ── CERTIFICATIONS & TRAINING (hidden — re-enable by uncommenting)
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
      ── */}

    </div>
  );
}
