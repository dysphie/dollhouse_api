const buildRunFilters = (filters, params) => {
    const where = [];

    if (filters.mapId != null) {
        where.push("r.map_id = ?");
        params.push(filters.mapId);
    }

    if (filters.tierId != null) {
        where.push("m.tier_id = ?");
        params.push(filters.tierId);
    }

    if (filters.after != null) {
        where.push("r.created_at >= ?");
        params.push(filters.after);
    }

    if (filters.before != null) {
        where.push("r.created_at <= ?");
        params.push(filters.before);
    }

    return where.length ? "\nWHERE " + where.join("\nAND ") : "";
};

const buildMutatorClause = (mutators, params) => {
    if (mutators == null) return "";

    if (mutators.length === 0) {
        return `
            AND NOT EXISTS (
                SELECT 1
                FROM runs mr
                JOIN run_mutators rm ON rm.run_id = mr.run_id
                WHERE mr.session_id = sb.session_id
            )
        `;
    }

    const inList = mutators.map(() => "?").join(",");

    const clause = `
        AND NOT EXISTS (
            SELECT 1
            FROM runs mr
            JOIN run_mutators rm ON rm.run_id = mr.run_id
            WHERE mr.session_id = sb.session_id
              AND rm.mutator_id NOT IN (${inList})
        )
        AND (
            SELECT COUNT(DISTINCT rm2.mutator_id)
            FROM runs mr2
            JOIN run_mutators rm2 ON rm2.run_id = mr2.run_id
            WHERE mr2.session_id = sb.session_id
              AND rm2.mutator_id IN (${inList})
        ) = ?
    `;

    params.push(...mutators, ...mutators, mutators.length);
    return clause;
};

const buildTagClause = (tags, params) => {
    if (tags == null || tags.length === 0) return "";

    const inList = tags.map(() => "?").join(",");

    const clause = `
        AND (
            SELECT COUNT(DISTINCT rt.perf_tag_id)
            FROM runs tr
            JOIN run_perf_tags rt ON rt.run_id = tr.run_id
            WHERE tr.session_id = sb.session_id
              AND rt.perf_tag_id IN (${inList})
        ) = ?
    `;

    params.push(...tags, tags.length);

    return clause;
};

const buildPlayerClause = (playerId, params) => {
    if (playerId == null) return "";

    params.push(playerId);

    return `
        AND EXISTS (
            SELECT 1
            FROM runs pr
            WHERE pr.session_id = sb.session_id
              AND pr.player_id = ?
        )
    `;
};

const findSessionIds = (db, filters) => {
    const cteParams = [];
    const runWhere = buildRunFilters(filters, cteParams);

    const cte = `
        WITH session_base AS (
            SELECT
                r.session_id AS session_id,
                r.map_id AS map_id,
                MIN(r.created_at) AS started_at,
                MAX(r.created_at) AS ended_at,
                COUNT(*) AS player_count
            FROM runs r
            JOIN maps m ON m.id = r.map_id
            ${runWhere}
            GROUP BY r.session_id, r.map_id
        )
    `;

    const filterParams = [];
    const mutatorClause = buildMutatorClause(filters.mutators, filterParams);
    const tagClause = buildTagClause(filters.tags, filterParams);
    const playerClause = buildPlayerClause(filters.player, filterParams);

    const countSql = `
        ${cte}
        SELECT COUNT(*) AS total
        FROM session_base sb
        WHERE 1=1
        ${mutatorClause}
        ${tagClause}
        ${playerClause}
    `;

    const total = db.prepare(countSql)
        .get(...cteParams, ...filterParams)
        .total;

    const pageSql = `
        ${cte}
        SELECT sb.session_id, sb.map_id, sb.started_at, sb.ended_at, sb.player_count
        FROM session_base sb
        WHERE 1=1
        ${mutatorClause}
        ${tagClause}
        ${playerClause}
        ORDER BY sb.started_at DESC
        LIMIT ?
        OFFSET ?
    `;

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    const sessions = db.prepare(pageSql)
        .all(...cteParams, ...filterParams, limit, offset);

    return { sessions, total };
};

const hydrateSessions = (db, sessions) => {
    if (!sessions.length) return [];

    const sessionIds = sessions.map((s) => s.session_id);
    const sessionIdPlaceholders = sessionIds.map(() => "?").join(",");

    const mapIds = [...new Set(sessions.map((s) => s.map_id))];
    const mapIdPlaceholders = mapIds.map(() => "?").join(",");

    const maps = db.prepare(`
        SELECT id, filename, stage, tier_id
        FROM maps
        WHERE id IN (${mapIdPlaceholders})
    `).all(...mapIds);
    const mapsById = new Map(maps.map((m) => [m.id, m]));

    const runs = db.prepare(`
        SELECT
            r.run_id,
            r.session_id,
            r.player_id,
            p.name AS player_name,
            p.steam_id,
            r.damage_taken,
            r.zombie_damage_taken,
            r.zombie_damage_dealt,
            r.kills,
            r.deaths,
            r.presence_percentage,
            r.extraction_time,
            r.replay_id,
            r.points_awarded,
            r.created_at
        FROM runs r
        JOIN players p ON p.id = r.player_id
        WHERE r.session_id IN (${sessionIdPlaceholders})
        ORDER BY r.session_id, r.extraction_time IS NULL, r.extraction_time ASC
    `).all(...sessionIds);

    const runIds = runs.map((r) => r.run_id);
    const runIdPlaceholders = runIds.map(() => "?").join(",");

    const mutatorRows = runIds.length ? db.prepare(`
        SELECT run_id, mutator_id
        FROM run_mutators
        WHERE run_id IN (${runIdPlaceholders})
    `).all(...runIds) : [];

    const tagRows = runIds.length ? db.prepare(`
        SELECT run_id, perf_tag_id
        FROM run_perf_tags
        WHERE run_id IN (${runIdPlaceholders})
    `).all(...runIds) : [];

    const weaponRows = runIds.length ? db.prepare(`
        SELECT run_id, weapon_id, kills
        FROM run_weapon_kills
        WHERE run_id IN (${runIdPlaceholders})
    `).all(...runIds) : [];

    const mutatorsByRun = new Map();
    for (const row of mutatorRows) {
        if (!mutatorsByRun.has(row.run_id)) mutatorsByRun.set(row.run_id, []);
        mutatorsByRun.get(row.run_id).push(row.mutator_id);
    }

    const tagsByRun = new Map();
    for (const row of tagRows) {
        if (!tagsByRun.has(row.run_id)) tagsByRun.set(row.run_id, []);
        tagsByRun.get(row.run_id).push(row.perf_tag_id);
    }

    const weaponsByRun = new Map();
    for (const row of weaponRows) {
        if (!weaponsByRun.has(row.run_id)) weaponsByRun.set(row.run_id, []);
        weaponsByRun.get(row.run_id).push({
            weapon_id: row.weapon_id,
            kills: row.kills,
        });
    }

    const runsBySession = new Map();
    for (const run of runs) {
        if (!runsBySession.has(run.session_id)) runsBySession.set(run.session_id, []);

        runsBySession.get(run.session_id).push({
            run_id: run.run_id,
            player_id: run.player_id,
            player_name: run.player_name,
            steam_id: run.steam_id,
            damage_taken: run.damage_taken,
            zombie_damage_taken: run.zombie_damage_taken,
            zombie_damage_dealt: run.zombie_damage_dealt,
            kills: run.kills,
            deaths: run.deaths,
            presence_percentage: run.presence_percentage,
            extraction_time: run.extraction_time,
            replay_id: run.replay_id,
            points_awarded: run.points_awarded,
            created_at: run.created_at,
            tag_ids: tagsByRun.get(run.run_id) ?? [],
            weapon_kills: weaponsByRun.get(run.run_id) ?? [],
        });
    }

    return sessions.map((s) => {
        const sessionRuns = runsBySession.get(s.session_id) ?? [];

        const mutatorSet = new Set();
        for (const run of sessionRuns) {
            const runMutators = mutatorsByRun.get(run.run_id) ?? [];
            for (const id of runMutators) mutatorSet.add(id);
        }

        const map = mapsById.get(s.map_id);

        const ret = {
            session_id: s.session_id,
            map_id: s.map_id,
            map_name: map ? map.filename : null,
            map_stage: map ? map.stage : null,
            started_at: s.started_at,
            ended_at: s.ended_at,
            player_count: s.player_count,
            mutator_ids: [...mutatorSet],
            runs: sessionRuns,
        };

        return ret;
    });
};

const search = (db, filters = {}) => {
    const { sessions, total } = findSessionIds(db, filters);
    const matches = hydrateSessions(db, sessions);

    return matches;
};

export const MatchesService = {
    search,
};