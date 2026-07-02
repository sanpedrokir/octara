'use client';

import { useState, useRef } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

interface CoverLetterData {
  letter: string;
  subject_line: string;
  key_matches: string[];
  name: string;
  targetRole: string;
  company: string;
}

export default function CoverLetterPage() {
  const [jobTitle, setJobTitle]       = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [data, setData]               = useState<CoverLetterData | null>(null);
  const [copied, setCopied]           = useState(false);
  const [showText, setShowText]       = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function generate() {
    setLoading(true);
    setError('');
    setData(null);
    setCopied(false);
    setShowText(false);
    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, companyName, jobDescription }),
      });
      const { data: d, error: e } = await res.json() as { data: CoverLetterData | null; error: string | null };
      if (e) setError(e); else setData(d);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLetter() {
    if (!data) return;
    const text = data.letter;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShowText(true);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>✉️ Cover Letter Generator</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Paste the job description and we'll write a personalised cover letter using your profile.
        </p>
      </div>

      {/* Input form */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Job Title</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--card-border)', color: 'var(--foreground)' }}
              placeholder=""
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Company Name</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--card-border)', color: 'var(--foreground)' }}
              placeholder=""
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Job Description <span style={{ color: 'var(--muted)' }}>(paste the full JD)</span>
          </label>
          <textarea
            className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--card-border)', color: 'var(--foreground)', minHeight: '160px' }}
            placeholder=""
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
          />
        </div>

        <button
          className="btn-primary w-full"
          onClick={generate}
          disabled={loading || jobDescription.trim().length < 50}
        >
          {loading ? 'Generating…' : '✉️ Generate Cover Letter'}
        </button>

        {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>

      {/* Result */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <LoadingSpinner label="Writing your cover letter…" />
        </div>
      )}

      {data && (
        <div className="space-y-4 animate-fade-in">
          {/* Key matches */}
          {data.key_matches?.length > 0 && (
            <div className="card p-4 space-y-2" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
              <p className="text-sm font-semibold" style={{ color: '#15803d' }}>✓ Matched to JD</p>
              <div className="flex flex-wrap gap-1.5">
                {data.key_matches.map((m, i) => (
                  <span key={i} className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Subject line */}
          <div className="card p-4 flex items-start gap-3" style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
            <span className="text-base shrink-0">📨</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold mb-0.5" style={{ color: '#1d4ed8' }}>Suggested Email Subject</p>
              <p className="text-sm font-medium" style={{ color: '#1e40af' }}>{data.subject_line}</p>
            </div>
          </div>

          {/* Letter */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Cover Letter</p>
              <div className="flex gap-2">
                <button
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                  onClick={() => setShowText(v => !v)}
                >
                  {showText ? 'Hide Text' : 'View as Text'}
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ background: copied ? '#dcfce7' : 'var(--primary)', color: copied ? '#15803d' : 'white', border: 'none' }}
                  onClick={copyLetter}
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>

            {showText && (
              <textarea
                ref={textareaRef}
                className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono resize-none focus:outline-none"
                style={{ borderColor: 'var(--card-border)', color: 'var(--foreground)', minHeight: '300px', background: '#f8fafc' }}
                readOnly
                value={data.letter}
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
            )}

            <div className="prose max-w-none text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {data.letter.split('\n\n').map((para, i) => (
                <p key={i} className="mb-3">{para}</p>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button className="btn-secondary flex-1" onClick={generate}>↺ Regenerate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
