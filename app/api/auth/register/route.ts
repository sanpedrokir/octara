import { db } from '@/lib/db';
import { signToken, setSessionCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return Response.json({ data: null, error: 'Name, email and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ data: null, error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (!/[A-Z]/.test(password)) {
      return Response.json({ data: null, error: 'Password must contain at least one capital letter' }, { status: 400 });
    }

    const sql = db();
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
    if (existing.length > 0) {
      return Response.json({ data: null, error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (${name}, ${email.toLowerCase()}, ${passwordHash}, 'learner')
      RETURNING id, email, name, role
    `;

    await sql`INSERT INTO profiles (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;

    const token = await signToken({ userId: user.id, email: user.email, role: user.role });
    await setSessionCookie(token);

    return Response.json({ data: { id: user.id, email: user.email, name: user.name, role: user.role }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
