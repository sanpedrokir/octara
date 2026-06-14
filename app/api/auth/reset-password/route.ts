import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();
    if (!token || !password) return Response.json({ data: null, error: 'Token and password are required' }, { status: 400 });

    if (password.length < 8) return Response.json({ data: null, error: 'Password must be at least 8 characters' }, { status: 400 });
    if (!/[A-Z]/.test(password)) return Response.json({ data: null, error: 'Password must contain at least one capital letter' }, { status: 400 });

    const sql = db();
    const rows = await sql`
      SELECT prt.user_id, prt.expires_at, u.email
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token = ${token}
    `;

    if (!rows.length) {
      return Response.json({ data: null, error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const { user_id, expires_at } = rows[0] as { user_id: number; expires_at: string };

    if (new Date(expires_at) < new Date()) {
      await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user_id}`;
      return Response.json({ data: null, error: 'Reset link has expired. Please request a new one.' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await sql`UPDATE users SET password_hash = ${password_hash} WHERE id = ${user_id}`;
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user_id}`;

    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    console.error('[reset-password]', err);
    return Response.json({ data: null, error: 'Something went wrong' }, { status: 500 });
  }
}
