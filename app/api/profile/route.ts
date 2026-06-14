import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();
    const [profile] = await sql`SELECT * FROM profiles WHERE user_id = ${session.userId}`;
    const [user] = await sql`SELECT id, email, name, created_at FROM users WHERE id = ${session.userId}`;
    return Response.json({ data: { ...user, profile: profile || null }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch profile';
    const status = msg === 'Unauthorized' ? 401 : 500;
    return Response.json({ data: null, error: msg }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { name, bio, phone, location, linkedin_url, resume_text } = body;

    const sql = db();

    if (name) {
      await sql`UPDATE users SET name = ${name} WHERE id = ${session.userId}`;
    }

    await sql`
      INSERT INTO profiles (user_id, bio, phone, location, linkedin_url, resume_text)
      VALUES (${session.userId}, ${bio || null}, ${phone || null}, ${location || null}, ${linkedin_url || null}, ${resume_text || null})
      ON CONFLICT (user_id) DO UPDATE SET
        bio = EXCLUDED.bio,
        phone = EXCLUDED.phone,
        location = EXCLUDED.location,
        linkedin_url = EXCLUDED.linkedin_url,
        resume_text = EXCLUDED.resume_text
    `;

    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update profile';
    const status = msg === 'Unauthorized' ? 401 : 500;
    return Response.json({ data: null, error: msg }, { status });
  }
}
