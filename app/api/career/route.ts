import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();

    // Ensure esco_occupation_id column exists
    await sql`ALTER TABLE career_aspirations ADD COLUMN IF NOT EXISTS esco_occupation_id INTEGER`;

    const [row] = await sql`
      SELECT ca.*,
             COALESCE(i.name, jrc.sector, ej.isco_group)   AS industry_name,
             COALESCE(jr.name, jrc.job_role, ej.occupation_title) AS job_role_name,
             COALESCE(jrc.track, ej.sub_group)             AS catalog_track,
             ej.esco_uri                                   AS esco_uri
      FROM career_aspirations ca
      LEFT JOIN industries i        ON ca.industry_id = i.id
      LEFT JOIN job_roles jr        ON ca.job_role_id = jr.id
      LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
      LEFT JOIN esco_job_catalog ej  ON ca.esco_occupation_id = ej.id
      WHERE ca.user_id = ${session.userId}
    `;
    return Response.json({ data: row || null, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch career aspiration';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { industry_id, job_role_id, catalog_job_role_id, esco_occupation_id, notes } = await request.json();

    const sql = db();
    await sql`ALTER TABLE career_aspirations ADD COLUMN IF NOT EXISTS esco_occupation_id INTEGER`;

    if (esco_occupation_id) {
      const [row] = await sql`
        INSERT INTO career_aspirations (user_id, industry_id, job_role_id, catalog_job_role_id, esco_occupation_id, notes, updated_at)
        VALUES (${session.userId}, NULL, NULL, NULL, ${esco_occupation_id}, ${notes || null}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          industry_id         = NULL,
          job_role_id         = NULL,
          catalog_job_role_id = NULL,
          esco_occupation_id  = EXCLUDED.esco_occupation_id,
          notes               = EXCLUDED.notes,
          updated_at          = NOW()
        RETURNING *
      `;
      return Response.json({ data: row, error: null });
    }

    if (catalog_job_role_id) {
      const [row] = await sql`
        INSERT INTO career_aspirations (user_id, industry_id, job_role_id, catalog_job_role_id, esco_occupation_id, notes, updated_at)
        VALUES (${session.userId}, NULL, NULL, ${catalog_job_role_id}, NULL, ${notes || null}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          industry_id         = NULL,
          job_role_id         = NULL,
          catalog_job_role_id = EXCLUDED.catalog_job_role_id,
          esco_occupation_id  = NULL,
          notes               = EXCLUDED.notes,
          updated_at          = NOW()
        RETURNING *
      `;
      return Response.json({ data: row, error: null });
    }

    if (!industry_id || !job_role_id) {
      return Response.json({ data: null, error: 'Sector and job role are required' }, { status: 400 });
    }

    const [row] = await sql`
      INSERT INTO career_aspirations (user_id, industry_id, job_role_id, catalog_job_role_id, esco_occupation_id, notes, updated_at)
      VALUES (${session.userId}, ${industry_id}, ${job_role_id}, NULL, NULL, ${notes || null}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        industry_id         = EXCLUDED.industry_id,
        job_role_id         = EXCLUDED.job_role_id,
        catalog_job_role_id = NULL,
        esco_occupation_id  = NULL,
        notes               = EXCLUDED.notes,
        updated_at          = NOW()
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save career aspiration';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
