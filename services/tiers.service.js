const list = (db) => {
    return db.prepare(`
        SELECT
            id,
            name,
            description,
            points,
            enabled
        FROM tiers
        WHERE enabled = 1
        ORDER BY points ASC
    `).all();
};

const findByName = (db, query) => {
    return db.prepare(`
        SELECT
            id,
            name,
            description,
            points,
            enabled
        FROM tiers
        WHERE enabled = 1
          AND name LIKE '%' || ? || '%' COLLATE NOCASE
        ORDER BY points ASC
    `).all(query);
};

const disableAll = (db) => {
    return db.prepare(`
        UPDATE tiers
        SET enabled = 0
    `).run();
};

const getById = (db, id) => {
    return db.prepare(`
        SELECT
            id,
            name,
            description,
            points,
            enabled
        FROM tiers
        WHERE id = ?
          AND enabled = 1
    `).get(id);
};

const upsert = (db, tier) => {
    return db.prepare(`
        INSERT INTO tiers (
            name,
            description,
            points,
            enabled
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            description = excluded.description,
            points = excluded.points,
            enabled = excluded.enabled
        RETURNING *
    `).get(
        tier.name,
        tier.description,
        tier.points,
        tier.enabled
    );
};

export const TiersService = {
    list,
    findByName,
    disableAll,
    getById,
    upsert
};