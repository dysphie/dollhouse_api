const list = (db) => {
    return db.prepare(`
        SELECT
            id,
            name,
            description,
            enabled
        FROM map_tags
        WHERE enabled = 1
        ORDER BY name
    `).all();
};

const upsert = (db, mapTag) => {
    return db.prepare(`
        INSERT INTO map_tags (
            name,
            description,
            enabled
        )
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            description = excluded.description,
            enabled = excluded.enabled
        RETURNING *
    `).get(
        mapTag.name,
        mapTag.description,
        mapTag.enabled
    );
};

const disableAll = (db) => {
    return db.prepare(`
        UPDATE map_tags
        SET enabled = 0
    `).run();
};

export const MapTagsService = {
    list,
    upsert,
    disableAll
};