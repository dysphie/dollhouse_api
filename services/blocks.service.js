const update = (db, playerId, targetPlayerId, blocks) => {
    const insert = db.prepare(`
        INSERT OR IGNORE INTO communication_blocks (
            player_id,
            target_player_id,
            kind
        )
        VALUES (?, ?, ?)
    `);

    const remove = db.prepare(`
        DELETE FROM communication_blocks
        WHERE
            player_id = ?
            AND target_player_id = ?
            AND kind = ?
    `);

    const transaction = db.transaction(() => {
        for (const [kind, blocked] of Object.entries(blocks)) {
            if (blocked) {
                insert.run(playerId, targetPlayerId, kind);
            } else {
                remove.run(playerId, targetPlayerId, kind);
            }
        }
    });

    transaction();
};

const get = (db, playerId) => {
    return db.prepare(`
        SELECT
            id,
            target_player_id,
            kind,
            created_at
        FROM communication_blocks
        WHERE player_id = ?
        ORDER BY target_player_id, kind
    `).all(playerId);
};

export const CommunicationBlocksService = {
    update,
    get
};