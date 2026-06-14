import { db } from '@/lib/db';
import { signToken, setSessionCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ data: null, error: 'Email and password are required' }, { status: 400 });
    }

    const sql = db();
    const [user] = await sql`SELECT id, email, name, role, password_hash FROM users WHERE email = ${email.toLowerCase()}`;

    if (!user) {
      return Response.json({ data: null, error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return Response.json({ data: null, error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await signToken({ userId: user.id, email: user.email, role: user.role });
    await setSessionCookie(token);

    return Response.json({ data: { id: user.id, email: user.email, name: user.name, role: user.role }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
