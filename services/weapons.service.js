const list = (db) => {
    return db.prepare(`
        SELECT
            id,
            class_name,
            enabled
        FROM weapons
        WHERE enabled = 1
        ORDER BY class_name
    `).all();
};

const random = (db) => {
    return db.prepare(`
        SELECT
            id,
            class_name,
            enabled
        FROM weapons
        WHERE enabled = 1
        ORDER BY RANDOM()
        LIMIT 1
    `).get();
};

const upsert = (db, weapon) => {
    return db.prepare(`
        INSERT INTO weapons (
            class_name,
            enabled
        )
        VALUES (?, ?)
        ON CONFLICT(class_name) DO UPDATE SET
            enabled = excluded.enabled
        RETURNING *
    `).get(
        weapon.className,
        weapon.enabled
    );
};

export const WeaponsService = {
    list,
    upsert,
    random
};