import { escapeLike } from "../lib/sql-like.js";

const list = (db) => {
    return db.prepare(`
        SELECT
            m.id,
            m.filename,
            m.stage,
            m.enabled,
            t.id AS tier_id
        FROM maps m
        JOIN tiers t
            ON t.id = m.tier_id
        WHERE m.enabled = 1
        ORDER BY
            m.filename,
            m.stage
    `).all();
};

const upsert = (db, map) => {
    return db.prepare(`
        INSERT INTO maps (
            filename,
            stage,
            tier_id,
            enabled
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(filename, stage) DO UPDATE SET
            tier_id = excluded.tier_id,
            enabled = excluded.enabled
        RETURNING *
    `).get(
        map.filename,
        map.stage,
        map.tierId,
        map.enabled
    );
};

const disableAll = (db) => {
    return db.prepare(`
        UPDATE maps
        SET enabled = 0
    `).run();
};

const findByName = (db, query) => {
    return db.prepare(`
        SELECT
            id,
            filename,
            stage,
            tier_id,
            enabled
        FROM maps
        WHERE enabled = 1
          AND filename LIKE '%' || ? || '%' ESCAPE '\\' COLLATE NOCASE
        ORDER BY
            filename,
            stage
    `).all(escapeLike(query));
};

const getById = (db, id) => {
    const map = db.prepare(`
        SELECT
            m.id,
            m.filename,
            m.stage,
            m.enabled,
            t.id AS tier_id
        FROM maps m
        JOIN tiers t
            ON t.id = m.tier_id
        WHERE m.id = ?
          AND m.enabled = 1
    `).get(id);

    if (!map) return null;

    map.tags = db.prepare(`
        SELECT
            mt.id,
            mt.name,
            mt.description
        FROM map_map_tags mmt
        JOIN map_tags mt
            ON mt.id = mmt.map_tag_id
        WHERE mmt.map_id = ?
          AND mt.enabled = 1
        ORDER BY mt.name
    `).all(id);

    return map;
};

const random = (db) => {
    return db.prepare(`
        SELECT
            m.id,
            m.filename,
            m.stage,
            m.enabled,
            t.id AS tier_id
        FROM maps m
        JOIN tiers t
            ON t.id = m.tier_id
        WHERE m.enabled = 1
        ORDER BY RANDOM()
        LIMIT 1
    `).get();
};

export const MapsService = {
    upsert,
    disableAll,
    findByName,
    list,
    random,
    getById
};