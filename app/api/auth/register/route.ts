import { db } from '@/lib/db';
import { signToken, setSessionCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      firstName, lastName, email, password, userType,
      institution, level,
      company, title, otherDetails,
    } = body;

    // ── Validation ──────────────────────────────────────────────
    if (!firstName?.trim() || !lastName?.trim()) {
      return Response.json({ data: null, error: 'First and last name are required' }, { status: 400 });
    }
    if (!email?.trim()) {
      return Response.json({ data: null, error: 'Email address is required' }, { status: 400 });
    }
    if (!password) {
      return Response.json({ data: null, error: 'Password is required' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ data: null, error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (!/[A-Z]/.test(password)) {
      return Response.json({ data: null, error: 'Password must contain at least one uppercase letter' }, { status: 400 });
    }
    if (!userType || !['student', 'working_adult', 'other'].includes(userType)) {
      return Response.json({ data: null, error: 'Please select what best describes you' }, { status: 400 });
    }
    if (userType === 'student' && !institution?.trim()) {
      return Response.json({ data: null, error: 'Institution name is required' }, { status: 400 });
    }
    if ((userType === 'working_adult' || userType === 'other') && !company?.trim()) {
      return Response.json({ data: null, error: 'Company name is required' }, { status: 400 });
    }

    const sql = db();

    // ── Check duplicate email ────────────────────────────────────
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase().trim()}`;
    if (existing.length > 0) {
      return Response.json({ data: null, error: 'An account with this email already exists' }, { status: 409 });
    }

    // ── Create user ──────────────────────────────────────────────
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (${fullName}, ${email.toLowerCase().trim()}, ${passwordHash}, 'learner')
      RETURNING id, email, name, role
    ` as Array<{ id: number; email: string; name: string; role: string }>;

    // ── Ensure extra profile columns exist ───────────────────────
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title TEXT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_sector TEXT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_job_role TEXT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_experience INT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS highest_education TEXT`;

    // ── Create profile row ───────────────────────────────────────
    await sql`
      INSERT INTO profiles (user_id, user_type, company_name, job_title, bio)
      VALUES (
        ${user.id},
        ${userType},
        ${(userType !== 'student' ? company?.trim() : null) ?? null},
        ${(userType !== 'student' ? title?.trim() : null) ?? null},
        ${(userType !== 'student' && otherDetails?.trim()) ? otherDetails.trim() : null}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        user_type    = EXCLUDED.user_type,
        company_name = EXCLUDED.company_name,
        job_title    = EXCLUDED.job_title,
        bio          = EXCLUDED.bio
    `;

    // ── For students: save institution + level to education table ─
    if (userType === 'student' && institution?.trim()) {
      await sql`
        INSERT INTO education (user_id, institution, degree, is_current)
        VALUES (${user.id}, ${institution.trim()}, ${level ?? null}, true)
      `;
    }

    // ── Set session cookie ───────────────────────────────────────
    const token = await signToken({ userId: user.id, email: user.email, role: user.role });
    await setSessionCookie(token);

    return Response.json({ data: { id: user.id, email: user.email, name: user.name, role: user.role }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
