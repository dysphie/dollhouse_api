const list = (db) => {
    return db.prepare(`
        SELECT
            id,
            name,
            description,
            enabled
        FROM mutators
        WHERE enabled = 1
        ORDER BY name
    `).all();
};

const upsert = (db, mutator) => {
    return db.prepare(`
        INSERT INTO mutators (
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
        mutator.name,
        mutator.description,
        mutator.enabled
    );
};

const disableAll = (db) => {
    return db.prepare(`
        UPDATE mutators
        SET enabled = 0
    `).run();
};

export const MutatorsService = {
    list,
    upsert,
    disableAll
};