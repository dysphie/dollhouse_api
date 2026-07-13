const ALLOWED_COLS = new Set([
    "raw_maps",
    "show_self_keys",
    "show_other_keys",
    "show_ragdolls",
    "show_self_kills",
    "show_other_kills",
    "hide_tips",
    "render_distance",
    "hide_distance",
]);

const init = (db, playerId) => {
    db.prepare(`
        INSERT INTO settings (player_id)
        VALUES (?)
        ON CONFLICT(player_id) DO NOTHING
    `).run(playerId);
};

const updateColumns = (db, playerId, columns) => {
    const keys = Object.keys(columns);
    if (keys.length === 0) return;

    for (const key of keys) {
        if (!ALLOWED_COLS.has(key)) {
            throw new Error(`Refusing to update unknown settings column "${key}"`);
        }
    }

    const setClause = keys.map(key => `${key} = ?`).join(", ");
    const values = keys.map(key => {
        const value = columns[key];
        return typeof value === "boolean" ? (value ? 1 : 0) : value;
    });

    db.prepare(`
        UPDATE settings
        SET ${setClause}, updated_at = unixepoch('now')
        WHERE player_id = ?
    `).run(...values, playerId);
};

const replaceMutatorFilters = (db, playerId, mutatorIds) => {
    db.prepare(`DELETE FROM settings_filter_mutators WHERE player_id = ?`).run(playerId);

    const insert = db.prepare(`
        INSERT INTO settings_filter_mutators (player_id, mutator_id)
        VALUES (?, ?)
    `);
    for (const mutatorId of mutatorIds) {
        insert.run(playerId, mutatorId);
    }
};

const replaceTagFilters = (db, playerId, tagIds) => {
    db.prepare(`DELETE FROM settings_filter_tags WHERE player_id = ?`).run(playerId);

    const insert = db.prepare(`
        INSERT INTO settings_filter_tags (player_id, tag_id)
        VALUES (?, ?)
    `);
    for (const tagId of tagIds) {
        insert.run(playerId, tagId);
    }
};

const getByPlayerId = (db, playerId) => {
    const settings = db.prepare(`
        SELECT
            raw_maps,
            show_self_keys,
            show_other_keys,
            show_ragdolls,
            show_self_kills,
            show_other_kills,
            hide_tips,
            render_distance,
            hide_distance,
            created_at,
            updated_at
        FROM settings
        WHERE player_id = ?
    `).get(playerId);

    if (!settings) return null; // FIXME: upsert here and re-call?

    const mutatorIds = db.prepare(`
        SELECT mutator_id FROM settings_filter_mutators WHERE player_id = ?
    `).all(playerId).map(row => row.mutator_id);

    const tagIds = db.prepare(`
        SELECT tag_id FROM settings_filter_tags WHERE player_id = ?
    `).all(playerId).map(row => row.tag_id);

    return { ...settings, mutator_ids: mutatorIds, tag_ids: tagIds };
};

const update = (db, playerId, settings) => {
    const { mutator_ids, tag_ids, ...columns } = settings;

    const runUpdate = db.transaction(() => {
        init(db, playerId);
        updateColumns(db, playerId, columns);

        if (mutator_ids !== undefined) {
            replaceMutatorFilters(db, playerId, mutator_ids);
        }

        if (tag_ids !== undefined) {
            replaceTagFilters(db, playerId, tag_ids);
        }
    });

    runUpdate();

    return getByPlayerId(db, playerId);
};

export const SettingsService = {
    getByPlayerId,
    update,
    init
};