import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const ENTITY_NAMES = ['Experiments', 'Missions', 'OutreachContacts', 'WeeklyReflections', 'ProofOfWork'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Destructive maintenance endpoint: only app admins (or the internal
    // scheduled/service caller) may run it.
    let caller = null;
    try {
      caller = await base44.auth.me();
    } catch (_) {
      caller = null;
    }
    const isService = !!caller?.is_service;
    const isAdmin = caller?.role === 'admin';
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin && !isService) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date().toISOString();

    let totalDeleted = 0;
    let totalFailed = 0;
    const details = [];

    for (const entityName of ENTITY_NAMES) {
      let deleted = 0;
      let failed = 0;
      try {
        // Fetch records with deletion_status=deleted where purge_at has passed
        const records = await base44.asServiceRole.entities[entityName].filter(
          { deletion_status: 'deleted' },
          '-deleted_at',
          500
        );

        const expired = records.filter(r => r.purge_at && r.purge_at <= now);

        for (const record of expired) {
          try {
            await base44.asServiceRole.entities[entityName].update(record.id, {
              deletion_status: 'permanently_deleted'
            });
            await base44.asServiceRole.entities[entityName].delete(record.id);
            deleted++;
          } catch (err) {
            console.error(`Failed to purge ${entityName} record ${record.id}:`, err.message);
            failed++;
          }
        }
      } catch (err) {
        console.error(`Failed to query ${entityName}:`, err.message);
        failed++;
      }

      details.push({ entity: entityName, deleted, failed });
      totalDeleted += deleted;
      totalFailed += failed;
    }

    return Response.json({
      success: true,
      run_at: now,
      total_deleted: totalDeleted,
      total_failed: totalFailed,
      details
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});