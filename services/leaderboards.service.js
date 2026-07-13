import { applyMutatorTagFilters } from "../lib/run-filters.js";

const DEFAULT_LIMIT = 50;

const fastestOnMap = (db, mapId, filters = {}) => {
    const where = ["r.map_id = ?", "r.extraction_time IS NOT NULL"];
    const params = [mapId];

    applyMutatorTagFilters(filters, where, params);

    const limit = filters.limit ?? DEFAULT_LIMIT;
    const offset = filters.offset ?? 0;

    const sql = `
        WITH filtered_runs AS (
            SELECT r.*
            FROM runs r
            WHERE ${where.join("\nAND ")}
        ),
        best_per_player AS (
            SELECT
                *,
                ROW_NUMBER() OVER (
                    PARTITION BY player_id
                    ORDER BY extraction_time ASC, created_at ASC
                ) AS rn
            FROM filtered_runs
        ),
        ranked AS (
            SELECT
                b.player_id,
                p.name AS player_name,
                p.steam_id,
                b.run_id,
                b.extraction_time AS best_time,
                b.created_at,
                DENSE_RANK() OVER (
                    ORDER BY b.extraction_time ASC
                ) AS rank
            FROM best_per_player b
            JOIN players p ON p.id = b.player_id
            WHERE b.rn = 1
        )
        SELECT
            player_id,
            player_name,
            steam_id,
            run_id,
            best_time,
            created_at,
            rank
        FROM ranked
        ORDER BY rank ASC, created_at ASC
        LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    return db.prepare(sql).all(...params);
};

const mostRecords = (db, filters = {}) => {
    const where = ["r.extraction_time IS NOT NULL"];
    const params = [];

    applyMutatorTagFilters(filters, where, params);

    const limit = filters.limit ?? DEFAULT_LIMIT;
    const offset = filters.offset ?? 0;

    const sql = `
        WITH filtered_runs AS (
            SELECT r.*
            FROM runs r
            WHERE ${where.join("\nAND ")}
        ),
        ranked AS (
            SELECT
                *,
                RANK() OVER (
                    PARTITION BY map_id
                    ORDER BY extraction_time ASC
                ) AS map_rank
            FROM filtered_runs
        ),
        records AS (
            SELECT map_id, player_id
            FROM ranked
            WHERE map_rank = 1
        ),
        player_records AS (
            SELECT
                records.player_id,
                p.name AS player_name,
                p.steam_id,
                COUNT(DISTINCT records.map_id) AS record_count
            FROM records
            JOIN players p ON p.id = records.player_id
            GROUP BY records.player_id
        ),
        ranked_players AS (
            SELECT
                player_id,
                player_name,
                steam_id,
                record_count,
                DENSE_RANK() OVER (
                    ORDER BY record_count DESC
                ) AS rank
            FROM player_records
        )
        SELECT
            player_id,
            player_name,
            steam_id,
            record_count,
            rank
        FROM ranked_players
        ORDER BY rank ASC, record_count DESC
        LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    return db.prepare(sql).all(...params);
};

const mostExtractions = (db, filters = {}) => {
    const where = ["r.extraction_time IS NOT NULL"];
    const params = [];

    applyMutatorTagFilters(filters, where, params);

    const limit = filters.limit ?? DEFAULT_LIMIT;
    const offset = filters.offset ?? 0;

    const sql = `
        WITH filtered_runs AS (
            SELECT r.*
            FROM runs r
            WHERE ${where.join("\nAND ")}
        ),
        player_extractions AS (
            SELECT
                filtered_runs.player_id,
                p.name AS player_name,
                p.steam_id,
                COUNT(DISTINCT filtered_runs.map_id) AS extraction_count
            FROM filtered_runs
            JOIN players p ON p.id = filtered_runs.player_id
            GROUP BY filtered_runs.player_id
        ),
        ranked_players AS (
            SELECT
                player_id,
                player_name,
                steam_id,
                extraction_count,
                DENSE_RANK() OVER (
                    ORDER BY extraction_count DESC
                ) AS rank
            FROM player_extractions
        )
        SELECT
            player_id,
            player_name,
            steam_id,
            extraction_count,
            rank
        FROM ranked_players
        ORDER BY rank ASC, extraction_count DESC
        LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    return db.prepare(sql).all(...params);
};

const DEFAULT_CONTEXT = 5;

const fastestOnMapAroundPlayer = (db, mapId, playerId, filters = {}) => {
    const where = ["r.map_id = ?", "r.extraction_time IS NOT NULL"];
    const params = [mapId];

    applyMutatorTagFilters(filters, where, params);

    const context = filters.context ?? DEFAULT_CONTEXT;

    const sql = `
        WITH filtered_runs AS (
            SELECT r.*
            FROM runs r
            WHERE ${where.join("\nAND ")}
        ),
        best_per_player AS (
            SELECT
                *,
                ROW_NUMBER() OVER (
                    PARTITION BY player_id
                    ORDER BY extraction_time ASC, created_at ASC
                ) AS rn
            FROM filtered_runs
        ),
        ranked AS (
            SELECT
                b.player_id,
                p.name AS player_name,
                p.steam_id,
                b.run_id,
                b.extraction_time AS best_time,
                b.created_at,
                DENSE_RANK() OVER (
                    ORDER BY b.extraction_time ASC
                ) AS rank,
                ROW_NUMBER() OVER (
                    ORDER BY b.extraction_time ASC, b.created_at ASC
                ) AS row_num
            FROM best_per_player b
            JOIN players p ON p.id = b.player_id
            WHERE b.rn = 1
        ),
        target AS (
            SELECT row_num FROM ranked WHERE player_id = ?
        )
        SELECT ranked.*
        FROM ranked, target
        WHERE ranked.row_num BETWEEN target.row_num - ? AND target.row_num + ?
        ORDER BY ranked.row_num ASC
    `;

    params.push(playerId, context, context);

    const rows = db.prepare(sql).all(...params);
    return rows.length ? rows : null;
};

const mostRecordsAroundPlayer = (db, playerId, filters = {}) => {
    const where = ["r.extraction_time IS NOT NULL"];
    const params = [];

    applyMutatorTagFilters(filters, where, params);

    const context = filters.context ?? DEFAULT_CONTEXT;

    const sql = `
        WITH filtered_runs AS (
            SELECT r.*
            FROM runs r
            WHERE ${where.join("\nAND ")}
        ),
        ranked AS (
            SELECT
                *,
                RANK() OVER (
                    PARTITION BY map_id
                    ORDER BY extraction_time ASC
                ) AS map_rank
            FROM filtered_runs
        ),
        records AS (
            SELECT map_id, player_id
            FROM ranked
            WHERE map_rank = 1
        ),
        player_records AS (
            SELECT
                records.player_id,
                p.name AS player_name,
                p.steam_id,
                COUNT(DISTINCT records.map_id) AS record_count
            FROM records
            JOIN players p ON p.id = records.player_id
            GROUP BY records.player_id
        ),
        ranked_players AS (
            SELECT
                player_id,
                player_name,
                steam_id,
                record_count,
                DENSE_RANK() OVER (
                    ORDER BY record_count DESC
                ) AS rank,
                ROW_NUMBER() OVER (
                    ORDER BY record_count DESC, player_id ASC
                ) AS row_num
            FROM player_records
        ),
        target AS (
            SELECT row_num FROM ranked_players WHERE player_id = ?
        )
        SELECT ranked_players.*
        FROM ranked_players, target
        WHERE ranked_players.row_num BETWEEN target.row_num - ? AND target.row_num + ?
        ORDER BY ranked_players.row_num ASC
    `;

    params.push(playerId, context, context);

    const rows = db.prepare(sql).all(...params);
    return rows.length ? rows : null;
};

const mostExtractionsAroundPlayer = (db, playerId, filters = {}) => {
    const where = ["r.extraction_time IS NOT NULL"];
    const params = [];

    applyMutatorTagFilters(filters, where, params);

    const context = filters.context ?? DEFAULT_CONTEXT;

    const sql = `
        WITH filtered_runs AS (
            SELECT r.*
            FROM runs r
            WHERE ${where.join("\nAND ")}
        ),
        player_extractions AS (
            SELECT
                filtered_runs.player_id,
                p.name AS player_name,
                p.steam_id,
                COUNT(DISTINCT filtered_runs.map_id) AS extraction_count
            FROM filtered_runs
            JOIN players p ON p.id = filtered_runs.player_id
            GROUP BY filtered_runs.player_id
        ),
        ranked_players AS (
            SELECT
                player_id,
                player_name,
                steam_id,
                extraction_count,
                DENSE_RANK() OVER (
                    ORDER BY extraction_count DESC
                ) AS rank,
                ROW_NUMBER() OVER (
                    ORDER BY extraction_count DESC, player_id ASC
                ) AS row_num
            FROM player_extractions
        ),
        target AS (
            SELECT row_num FROM ranked_players WHERE player_id = ?
        )
        SELECT ranked_players.*
        FROM ranked_players, target
        WHERE ranked_players.row_num BETWEEN target.row_num - ? AND target.row_num + ?
        ORDER BY ranked_players.row_num ASC
    `;

    params.push(playerId, context, context);

    const rows = db.prepare(sql).all(...params);
    return rows.length ? rows : null;
};

export const LeaderboardsService = {
    fastestOnMap,
    mostRecords,
    mostExtractions,
    fastestOnMapAroundPlayer,
    mostRecordsAroundPlayer,
    mostExtractionsAroundPlayer,
};