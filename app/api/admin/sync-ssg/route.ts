import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fetchAllSsgJobRoles, ssgGetDiag } from '@/lib/ssg-skills-api';

// GET — return last sync status from activity log
export async function GET() {
  try {
    const sql = db();
    const rows = await sql`
      SELECT metadata, created_at
      FROM user_activity_log
      WHERE action = 'ssg_sync'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!rows.length) return Response.json({ data: null, error: null });
    return Response.json({ data: rows[0], error: null });
  } catch {
    return Response.json({ data: null, error: null });
  }
}

export async function POST() {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const sql = db();
    let industriesAdded = 0;
    let industriesUpdated = 0;
    let rolesAdded = 0;
    let rolesUpdated = 0;

    // Fetch all sectors + job roles from the live SSG API
    const { sectors, jobRoles, total } = await fetchAllSsgJobRoles();

    if (sectors.length === 0 || jobRoles.length === 0) {
      const diag = await ssgGetDiag('/skillsFramework/jobRoles?pageNo=0&pageSize=1');
      const detail = diag.ok
        ? 'API returned HTTP 200 but no data found.'
        : `API returned HTTP ${diag.status || 'timeout/network'}: ${diag.error ?? 'No response'}`;
      return Response.json({
        data: null,
        error: `SSG Skills Framework returned no data. ${detail}`,
      }, { status: 502 });
    }

    // Upsert sectors as industries
    const sectorIdToDbId = new Map<string, number>();
    for (const sector of sectors) {
      const existing = await sql`SELECT id FROM industries WHERE name = ${sector.name}`;
      if (existing.length > 0) {
        sectorIdToDbId.set(sector.id, existing[0].id as number);
        industriesUpdated++;
      } else {
        const [row] = await sql`INSERT INTO industries (name) VALUES (${sector.name}) RETURNING id`;
        sectorIdToDbId.set(sector.id, row.id as number);
        industriesAdded++;
      }
    }

    // Upsert job roles
    for (const role of jobRoles) {
      const industryDbId = sectorIdToDbId.get(role.sectorId);
      if (!industryDbId) continue;

      const existing = await sql`
        SELECT id FROM job_roles WHERE industry_id = ${industryDbId} AND name = ${role.title}
      `;
      if (existing.length > 0) {
        rolesUpdated++;
      } else {
        await sql`
          INSERT INTO job_roles (industry_id, name)
          VALUES (${industryDbId}, ${role.title})
        `;
        rolesAdded++;
      }
    }

    const [indCount] = await sql`SELECT COUNT(*) AS count FROM industries`;
    const [roleCount] = await sql`SELECT COUNT(*) AS count FROM job_roles`;

    const meta = {
      industriesAdded,
      industriesUpdated,
      rolesAdded,
      rolesUpdated,
      totalIndustries: Number(indCount.count),
      totalRoles: Number(roleCount.count),
      ssgTotal: total,
    };

    await sql`
      INSERT INTO user_activity_log (user_id, action, entity_type, metadata)
      VALUES (${session.userId}, 'ssg_sync', 'industries', ${JSON.stringify(meta)})
    `;

    return Response.json({
      data: {
        ...meta,
        success: true,
        source: 'live',
        message: `✅ Live sync from SSG Skills Framework: ${meta.totalIndustries} industries and ${meta.totalRoles} job roles now in database. (${industriesAdded} new industries, ${rolesAdded} new roles this run.)`,
      },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
