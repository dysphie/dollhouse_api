const award = (db, playerId, transaction) => {
    return db.prepare(`
        INSERT INTO points_transactions (
            player_id,
            points,
            transaction_type,
            reason,
            run_id
        )
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
    `).get(
        playerId,
        transaction.points,
        transaction.transaction_type,
        transaction.reason,
        transaction.run_id ?? null
    );
};

const getHistory = (db, playerId, { limit, offset }) => {
  return db.prepare(`
    SELECT id, player_id, points, transaction_type, reason, run_id, created_at
    FROM points_transactions
    WHERE player_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(playerId, limit, offset);
};


const computePointsForRun = (db, run) => {
    const result = db.prepare(`
        SELECT
            COALESCE(t.points, 0) AS points
        FROM maps m
        LEFT JOIN tiers t
            ON t.id = m.tier_id
        WHERE m.id = ?
    `).get(run.mapId);

    return result?.points ?? 0;
};

export const PointsService = {
    award,
    computePointsForRun,
    getHistory
};