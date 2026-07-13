const list = (db) => {
    return db.prepare(`
        SELECT
            id,
            map_id,
            name,
            description,
            enabled
        FROM perf_tags
        WHERE enabled = 1
        ORDER BY name
    `).all();
};

const upsert = (db, perfTag) => {
    return db.prepare(`
        INSERT INTO perf_tags (
            map_id,
            name,
            description,
            enabled
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            map_id = excluded.map_id,
            description = excluded.description,
            enabled = excluded.enabled
        RETURNING *
    `).get(
        perfTag.mapId,
        perfTag.name,
        perfTag.description,
        perfTag.enabled
    );
};

const disableAll = (db) => {
    return db.prepare(`
        UPDATE perf_tags
        SET enabled = 0
    `).run();
};

export const PerfTagsService = {
    list,
    upsert,
    disableAll
};