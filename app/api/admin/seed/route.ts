import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { SEED_INDUSTRIES, SEED_JOB_ROLES } from '@/lib/seed-data';

export async function POST() {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const sql = db();
    let industriesAdded = 0;
    let rolesAdded = 0;

    for (const industry of SEED_INDUSTRIES) {
      const [existing] = await sql`SELECT id FROM industries WHERE name = ${industry.name}`;
      let industryId: number;

      if (!existing) {
        const [row] = await sql`
          INSERT INTO industries (name, description)
          VALUES (${industry.name}, ${industry.description})
          RETURNING id
        `;
        industryId = row.id;
        industriesAdded++;
      } else {
        industryId = existing.id;
      }

      const roles = SEED_JOB_ROLES[industry.name] || [];
      for (const role of roles) {
        const [existingRole] = await sql`SELECT id FROM job_roles WHERE industry_id = ${industryId} AND name = ${role.name}`;
        if (!existingRole) {
          await sql`
            INSERT INTO job_roles (industry_id, name, description, skill_keywords)
            VALUES (${industryId}, ${role.name}, ${role.description}, ${role.skill_keywords})
          `;
          rolesAdded++;
        }
      }
    }

    return Response.json({
      data: { success: true, industriesAdded, rolesAdded, message: `Seeded ${industriesAdded} industries and ${rolesAdded} job roles` },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Seed failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
