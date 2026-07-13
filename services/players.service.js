import { escapeLike } from "../lib/sql-like.js";
import { SettingsService } from "./settings.service.js";

const upsert = (db, player) => {
    const runUpsert = db.transaction(() => {
        const row = db.prepare(`
            INSERT INTO players (steam_id, name, last_seen, bio)
            VALUES (?, ?, COALESCE(?, unixepoch('now')), ?)
            ON CONFLICT(steam_id) DO UPDATE SET
                name = excluded.name,
                last_seen = COALESCE(excluded.last_seen, unixepoch('now')),
                bio = excluded.bio
            RETURNING *
        `).get(player.steamId, player.name, player.lastSeen ?? null, player.bio);

        
        SettingsService.init(db, row.id);

        return row;
    });

    return runUpsert();
};

const getById = (db, id) => {
    return db.prepare(`
        SELECT
            id,
            steam_id,
            name,
            join_date,
            last_seen,
            bio
        FROM players
        WHERE id = ?
    `).get(id);
};

const findByName = (db, query) => {
    return db.prepare(`
        SELECT
            id,
            steam_id,
            name,
            join_date,
            last_seen,
            bio
        FROM players
        WHERE name LIKE '%' || ? || '%' ESCAPE '\\' COLLATE NOCASE
        ORDER BY name
        LIMIT 50
    `).all(escapeLike(query));
};

export const PlayersService = {
    getById,
    upsert,
    findByName,
};