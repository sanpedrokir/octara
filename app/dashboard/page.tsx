import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import RecommendedCourses from '@/app/ui/RecommendedCourses';

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

  const recentCourses = await sql`
    SELECT course_title, provider_name, status FROM tracked_courses
    WHERE user_id = ${session.userId} ORDER BY created_at DESC LIMIT 3
  ` as Array<{ course_title: string; provider_name: string; status: string }>;

  const profileComplete = !!(profileData?.bio && profileData?.location);
  const hasCareer = !!career;
  const hasCourses = Number(courseStats?.total || 0) > 0;

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
            {hasCareer && !hasCourses && (
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

      {/* Career goal + recent courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Career goal */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>🎯 Career Goal</h2>
            <Link href="/career" className="text-xs font-medium no-underline" style={{ color: 'var(--primary)' }}>
              {hasCareer ? 'Edit' : 'Set goal →'}
            </Link>
          </div>
          {hasCareer ? (
            <div className="space-y-2">
              <div>
                <p className="text-xs uppercase tracking-wide font-medium mb-1" style={{ color: 'var(--muted)' }}>Industry</p>
                <p className="font-medium" style={{ color: 'var(--foreground)' }}>{career.industry_name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide font-medium mb-1" style={{ color: 'var(--muted)' }}>Target Role</p>
                <p className="font-medium" style={{ color: 'var(--foreground)' }}>{career.job_role_name}</p>
              </div>
              <div className="pt-3">
                <Link href="/skills-navigator" className="btn-primary text-sm no-underline" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                  Analyse Skills Gap →
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="text-4xl mb-3">🗺️</span>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Set your career goal to get started</p>
              <Link href="/career" className="btn-primary text-sm no-underline" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>Set Career Goal →</Link>
            </div>
          )}
        </div>

        {/* Recent courses */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>📚 Recent Courses</h2>
            <Link href="/skills-navigator" className="text-xs font-medium no-underline" style={{ color: 'var(--primary)' }}>View all →</Link>
          </div>
          {recentCourses.length > 0 ? (
            <div className="space-y-3">
              {recentCourses.map((course, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                  <span className="text-lg mt-0.5">{course.status === 'completed' ? '✅' : '📖'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{course.course_title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{course.provider_name || 'SkillsFuture'}</p>
                  </div>
                  <span className={`badge ${course.status === 'completed' ? 'badge-teal' : 'badge-blue'}`} style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {course.status === 'completed' ? 'Done' : 'In Progress'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="text-4xl mb-3">📖</span>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>No courses tracked yet</p>
              <Link href="/skills-navigator" className="btn-secondary text-sm no-underline" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>Discover Courses</Link>
            </div>
          )}
        </div>
      </div>

      {/* Recommended courses based on career goal */}
      {hasCareer && <RecommendedCourses />}

      {/* Quick actions */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/skills-navigator', icon: '🧭', label: 'Analyse Skills' },
            { href: '/my-courses', icon: '📚', label: 'My Courses' },
            { href: '/skills-navigator#roadmap', icon: '🗺️', label: 'View Roadmap' },
          ].map(action => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center p-3 rounded-xl text-center no-underline transition-colors gap-2"
              style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-xs font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
