import express from "express";
import { LeaderboardsService } from "../services/leaderboards.service.js";
import { validate } from "../middleware/validate.middleware.js";
import { leaderboardFiltersSchema } from "../validators/leaderboards.validator.js";

const router = express.Router();

router.get("/map/:mapId/fastest", validate(leaderboardFiltersSchema), (req, res) => {

    const { mapId } = req.validated.params;
    const { playerId, ...filters } = req.validated.query;

    if (playerId) {
        const results = LeaderboardsService.fastestOnMapAroundPlayer(req.db, mapId, playerId, filters);
        if (results === null) return res.status(404).json({ error: "Player has no qualifying run on this map" });
        return res.json(results);
    }

    const results = LeaderboardsService.fastestOnMap(req.db, mapId, filters);
    res.json(results);
});

router.get("/records", validate(leaderboardFiltersSchema), (req, res) => {
    const { playerId, ...filters } = req.validated.query;

    if (playerId) {
        const results = LeaderboardsService.mostRecordsAroundPlayer(req.db, playerId, filters);
        if (results === null) return res.status(404).json({ error: "Player holds no records under these filters" });
        return res.json(results);
    }

    const results = LeaderboardsService.mostRecords(req.db, filters);
    res.json(results);
});

router.get("/extractions", validate(leaderboardFiltersSchema), (req, res) => {
    const { playerId, ...filters } = req.validated.query;

    if (playerId) {
        const results = LeaderboardsService.mostExtractionsAroundPlayer(req.db, playerId, filters);
        if (results === null) return res.status(404).json({ error: "Player has no extractions under these filters" });
        return res.json(results);
    }

    const results = LeaderboardsService.mostExtractions(req.db, filters);
    res.json(results);
});

export default router;