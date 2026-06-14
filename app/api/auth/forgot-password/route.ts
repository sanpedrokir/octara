import { db } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) return Response.json({ data: null, error: 'Email is required' }, { status: 400 });

    const sql = db();
    const rows = await sql`SELECT id, name, email FROM users WHERE email = ${email.toLowerCase().trim()}`;

    // Always return success — don't reveal whether email exists
    if (!rows.length) {
      return Response.json({ data: { sent: true }, error: null });
    }

    const user = rows[0] as { id: number; name: string; email: string };

    // Delete any existing tokens for this user
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt.toISOString()})
    `;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail(user.email, resetUrl, user.name);

    return Response.json({ data: { sent: true }, error: null });
  } catch (err) {
    console.error('[forgot-password]', err);
    return Response.json({ data: null, error: 'Something went wrong' }, { status: 500 });
  }
}
