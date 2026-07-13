import { applyMutatorTagFilters } from "../lib/run-filters.js";
import { PointsService } from "./points.service.js";

const insert = (db, run) => {
    const tx = db.transaction((run) => {
        const result = db.prepare(`
            INSERT INTO runs (
                player_id,
                session_id,
                map_id,
                damage_taken,
                zombie_damage_taken,
                zombie_damage_dealt,
                kills,
                deaths,
                presence_percentage,
                extraction_time,
                replay_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            run.playerId,
            run.sessionId,
            run.mapId,
            run.damageTaken,
            run.zombieDamageTaken,
            run.zombieDamageDealt,
            run.kills,
            run.deaths,
            run.presencePercentage,
            run.extractionTime,
            run.replayId
        );

        const runId = result.lastInsertRowid;

        const insertMutator = db.prepare(`
            INSERT INTO run_mutators (
                run_id,
                mutator_id
            )
            VALUES (?, ?)
        `);

        for (const mutatorId of run.mutators)
            insertMutator.run(runId, mutatorId);

        const insertPerfTag = db.prepare(`
            INSERT INTO run_perf_tags (
                run_id,
                perf_tag_id
            )
            VALUES (?, ?)
        `);

        for (const perfTagId of run.tags)
            insertPerfTag.run(runId, perfTagId);

        const insertWeaponKills = db.prepare(`
            INSERT INTO run_weapon_kills (
                run_id,
                player_id,
                weapon_id,
                kills
            )
            VALUES (?, ?, ?, ?)
        `);

        for (const weapon of run.weaponKills)
            insertWeaponKills.run(
                runId,
                run.playerId,
                weapon.weaponId,
                weapon.kills
            );
        
        const pointsToAward = PointsService.computePointsForRun(db, run);

        db.prepare(`
            INSERT INTO points_transactions (
                player_id,
                points,
                transaction_type,
                reason,
                run_id
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            run.playerId,
            pointsToAward,
            "run_completion",
            "Run completion",
            runId
        );

        return runId;
    });

    return tx(run);
};

const search = (db, filters = {}) => {
    const where = [];
    const params = [];

    if (filters.playerId != null) {
        where.push("r.player_id = ?");
        params.push(filters.playerId);
    }

    if (filters.mapId != null) {
        where.push("r.map_id = ?");
        params.push(filters.mapId);
    }

    if (filters.tierId != null) {
        where.push("m.tier_id = ?");
        params.push(filters.tierId);
    }

    if (filters.minKills != null) {
        where.push("r.kills >= ?");
        params.push(filters.minKills);
    }

    if (filters.maxDeaths != null) {
        where.push("r.deaths <= ?");
        params.push(filters.maxDeaths);
    }

    if (filters.minPresence != null) {
        where.push("r.presence_percentage >= ?");
        params.push(filters.minPresence);
    }

    if (filters.after != null) {
        where.push("r.created_at >= ?");
        params.push(filters.after);
    }

    if (filters.before != null) {
        where.push("r.created_at <= ?");
        params.push(filters.before);
    }

    applyMutatorTagFilters(filters, where, params);

    let sql = `
        SELECT
            r.run_id,
            r.player_id,
            p.name AS player_name,
            p.steam_id,

            r.map_id,
            m.filename,
            m.stage,

            r.session_id,
            r.damage_taken,
            r.zombie_damage_taken,
            r.zombie_damage_dealt,
            r.kills,
            r.deaths,
            r.presence_percentage,
            r.created_at,
            r.extraction_time,
            r.replay_id
        FROM runs r
        JOIN players p
            ON p.id = r.player_id
        JOIN maps m
            ON m.id = r.map_id
    `;

    if (where.length)
        sql += "\nWHERE " + where.join("\nAND ");

    sql += `
        ORDER BY r.created_at DESC
    `;

    if (filters.limit != null) {
        sql += "\nLIMIT ?";
        params.push(filters.limit);

        if (filters.offset != null) {
            sql += "\nOFFSET ?";
            params.push(filters.offset);
        }
    }

    const runs = db.prepare(sql).all(...params);

    if (!runs.length) return runs;

    const runIds = runs.map((r) => r.run_id);
    const runIdPlaceholders = runIds.map(() => "?").join(",");

    const mutatorRows = db.prepare(`
        SELECT run_id, mutator_id
        FROM run_mutators
        WHERE run_id IN (${runIdPlaceholders})
    `).all(...runIds);

    const tagRows = db.prepare(`
        SELECT run_id, perf_tag_id
        FROM run_perf_tags
        WHERE run_id IN (${runIdPlaceholders})
    `).all(...runIds);

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

    for (const run of runs) {
        run.mutators = mutatorsByRun.get(run.run_id) ?? [];
        run.tags = tagsByRun.get(run.run_id) ?? [];
    }

    return runs;
};

export const RunsService = {
    insert,
    search,
};