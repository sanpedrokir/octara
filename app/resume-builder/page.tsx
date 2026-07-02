'use client';

import { useState } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

interface ResumeData {
  name: string;
  careerGoal: string;
  summary: string;
  technical_skills: string[];
  soft_skills: string[];
  experience_bullets: Array<{ title: string; company: string; period: string; bullets: string[] }>;
  education_lines: Array<{ institution: string; qualification: string; period: string }>;
  keywords: string[];
}

export default function ResumeBuilderPage() {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resume, setResume]     = useState<ResumeData | null>(null);
  const [copied, setCopied]     = useState(false);
  const [showText, setShowText] = useState(false);

  async function generate() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/resume-builder', { method: 'POST' });
    const { data, error: e } = await res.json();
    if (e) setError(e);
    else setResume(data);
    setLoading(false);
  }

  function buildPlainText(): string {
    if (!resume) return '';
    const lines: string[] = [
      resume.name.toUpperCase(),
      `Target Role: ${resume.careerGoal}`,
      '',
      '── PROFESSIONAL SUMMARY ──',
      resume.summary,
      '',
      '── SKILLS ──',
      `Technical: ${resume.technical_skills.join(' · ')}`,
      `Soft Skills: ${resume.soft_skills.join(' · ')}`,
      '',
      '── EXPERIENCE ──',
      ...resume.experience_bullets.flatMap(e => [
        `${e.title} | ${e.company}${e.period ? ` | ${e.period}` : ''}`,
        ...e.bullets.map(b => `  • ${b}`),
        '',
      ]),
      '── EDUCATION ──',
      ...resume.education_lines.map(e => `${e.institution} — ${e.qualification}${e.period ? ` (${e.period})` : ''}`),
      '',
      '── ATS KEYWORDS ──',
      resume.keywords.join(', '),
    ];
    return lines.join('\n');
  }

  async function copyToClipboard() {
    const text = buildPlainText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: create a temporary textarea and use execCommand
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* ignore */ }
      document.body.removeChild(el);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>📄 AI Resume Builder</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Generates a tailored resume using your career goal, skills, education, and work experience — optimised for Singapore employers and ATS systems.
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl px-4 py-3 text-xs space-y-1" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
        <p className="font-semibold">Before generating, make sure you have:</p>
        <p>✓ Set your <strong>Career Goal</strong> · ✓ Uploaded your <strong>CV</strong> (Competency Profile) · ✓ Added <strong>Education</strong> and <strong>Experience</strong> (My Profile)</p>
      </div>

      {/* Generate button */}
      {!resume && (
        <button
          onClick={generate}
          disabled={loading}
          className="btn-primary px-8 py-3 text-sm"
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? <><LoadingSpinner label="" /> Generating resume…</> : '✨ Generate My Resume'}
        </button>
      )}

      {error && (
        <div className="card p-4 text-sm" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Resume output */}
      {resume && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={copyToClipboard} className="btn-primary text-sm px-5">
              {copied ? '✓ Copied!' : '📋 Copy as Plain Text'}
            </button>
            <button onClick={() => setShowText(v => !v)} className="btn-secondary text-sm px-5">
              {showText ? 'Hide Text' : '📄 View as Text'}
            </button>
            <button onClick={generate} disabled={loading} className="btn-secondary text-sm px-5" style={{ opacity: loading ? 0.6 : 1 }}>
              {loading ? '⏳ Regenerating…' : '🔄 Regenerate'}
            </button>
          </div>

          {showText && (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Select all text below and copy (Ctrl+A then Ctrl+C):</p>
              <textarea
                readOnly
                value={buildPlainText()}
                rows={20}
                className="w-full rounded-xl p-3 text-xs font-mono border"
                style={{ border: '1.5px solid var(--card-border)', color: 'var(--foreground)', background: '#f8faff', resize: 'vertical' }}
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
          )}

          {/* Resume card */}
          <div className="card p-6 space-y-6" style={{ fontFamily: 'Georgia, serif' }}>

            {/* Name + role */}
            <div className="border-b pb-4" style={{ borderColor: 'var(--card-border)' }}>
              <h2 className="text-2xl font-bold tracking-wide" style={{ color: 'var(--foreground)' }}>{resume.name}</h2>
              <p className="text-sm mt-1 font-semibold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>{resume.careerGoal}</p>
            </div>

            {/* Summary */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Professional Summary</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{resume.summary}</p>
            </section>

            {/* Skills */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Skills</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Technical: </span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{resume.technical_skills.join(' · ')}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Soft Skills: </span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{resume.soft_skills.join(' · ')}</span>
                </div>
              </div>
            </section>

            {/* Experience */}
            {resume.experience_bullets.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Experience</h3>
                <div className="space-y-4">
                  {resume.experience_bullets.map((e, i) => (
                    <div key={i}>
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{e.title} — {e.company}</p>
                        {e.period && <p className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{e.period}</p>}
                      </div>
                      <ul className="mt-1.5 space-y-1 pl-3">
                        {e.bullets.map((b, j) => (
                          <li key={j} className="text-sm" style={{ color: 'var(--foreground)', listStyle: 'disc', marginLeft: '0.5rem' }}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {resume.education_lines.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Education</h3>
                <div className="space-y-2">
                  {resume.education_lines.map((e, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{e.institution}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{e.qualification}</p>
                      </div>
                      {e.period && <p className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{e.period}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Keywords */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>ATS Keywords</h3>
              <div className="flex flex-wrap gap-1.5">
                {resume.keywords.map((k, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{k}</span>
                ))}
              </div>
            </section>
          </div>

          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            AI-generated content. Review and personalise before sending to employers.
          </p>
        </div>
      )}
    </div>
  );
}
