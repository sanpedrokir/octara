import Link from 'next/link';
import Navbar from './ui/Navbar';
import CourseSearchWidget from './ui/CourseSearchWidget';

const otherFeatures = [
  { icon: '🧠', title: 'AI Skills Gap Analysis', desc: 'Upload your resume or describe your experience. Our AI pinpoints exactly which skills you need for your target role.' },
  { icon: '🗺️', title: 'Personalised Learning Roadmap', desc: 'Get a 6 or 12-month AI-generated roadmap with milestones, sequenced by priority and your available time.' },
  { icon: '📈', title: 'Progress Tracking', desc: 'Track courses in-progress and completed. Visualise your upskilling journey and celebrate milestones.' },
  { icon: '🎯', title: 'Career Goal Setting', desc: 'Set your target industry and role from 15+ Singapore industry sectors and 100+ job roles.' },
  { icon: '💼', title: 'Professional Profile', desc: 'Maintain your education, work history and skills in one place to power smarter recommendations.' },
];

const steps = [
  { step: '01', title: 'Create Your Profile', desc: 'Add your experience, education and current skills.' },
  { step: '02', title: 'Set Career Goal', desc: 'Choose your target industry and job role.' },
  { step: '03', title: 'Run AI Analysis', desc: 'AI analyses your gaps against your target role.' },
  { step: '04', title: 'Get Your Roadmap', desc: 'Receive a personalised SkillsFuture learning roadmap.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={null} />

      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-4 py-20 sm:py-32 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #004578 0%, #0078d4 55%, #2b88d8 100%)' }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}>
            🇸🇬 Powered by SkillsFuture Singapore + AI
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Navigate Your Career.<br />
            <span style={{ color: '#a9d4f5' }}>Upskill Smarter.</span>
          </h1>
          <p className="text-lg sm:text-xl mb-10 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.85)' }}>
            AI-powered career pathfinding, skills gap analysis, and personalised SkillsFuture learning roadmaps — built for Singapore professionals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-base px-8 py-3 no-underline" style={{ background: 'white', color: 'var(--primary-dark)', fontSize: '1rem' }}>
              Start Free →
            </Link>
            <Link href="/login" className="btn-secondary text-base px-8 py-3 no-underline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', fontSize: '1rem' }}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4" style={{ background: 'var(--background)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12" style={{ color: 'var(--foreground)' }}>
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(s => (
              <div key={s.step} className="flex flex-col items-center text-center p-6 card">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-4" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  {s.step}
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{s.title}</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4" style={{ background: 'var(--muted-bg)' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4" style={{ color: 'var(--foreground)' }}>
            Everything you need to level up
          </h2>
          <p className="text-center mb-10" style={{ color: 'var(--muted)' }}>Designed for Singapore professionals navigating career transitions</p>

          {/* SkillsFuture Course Finder — featured full-width card */}
          <div
            className="rounded-2xl p-6 sm:p-8 mb-8"
            style={{ background: 'linear-gradient(135deg, #004578 0%, #0078d4 60%, #2b88d8 100%)' }}
          >
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
              <div className="lg:w-72 shrink-0">
                <div className="text-3xl mb-3">📚</div>
                <h3 className="font-bold text-xl mb-2 text-white">SkillsFuture Course Finder</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Instantly discover government-subsidised Singapore courses aligned to your skill gaps. Live results from the SkillsFuture course directory.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>SSG Credits Eligible</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>Up to 70% Subsidy</span>
                </div>
              </div>
              <div className="flex-1">
                <CourseSearchWidget />
              </div>
            </div>
          </div>

          {/* Other feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherFeatures.map(f => (
              <div key={f.title} className="card p-6 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--foreground)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 text-center" style={{ background: 'linear-gradient(135deg, #004578 0%, #0078d4 100%)' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Ready to chart your career path?</h2>
          <p className="mb-8" style={{ color: 'rgba(255,255,255,0.8)' }}>Join Singapore professionals using Octara to navigate their career journeys.</p>
          <Link href="/register" className="btn-primary text-base px-10 py-3 no-underline" style={{ background: 'white', color: 'var(--primary-dark)', fontSize: '1rem' }}>
            Get started free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-sm" style={{ background: 'var(--primary-dark)', color: 'rgba(255,255,255,0.6)' }}>
        <p>© 2026 Octara · AI-Powered Career Pathfinder for Singapore Professionals</p>
        <p className="mt-1">Powered by SkillsFuture Singapore APIs · OpenAI · Neon PostgreSQL</p>
      </footer>
    </div>
  );
}
