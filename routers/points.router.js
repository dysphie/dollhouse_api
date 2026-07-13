import express from "express";
import { validate } from "../middleware/validate.middleware.js";
import { awardPointsSchema, getPointsHistorySchema } from "../validators/points.validator.js";
import { PointsService } from "../services/points.service.js";
import { PlayersService } from "../services/players.service.js";
import { requireServerKey } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/players/:playerId/points", requireServerKey, validate(awardPointsSchema), (req, res) => {
    const { playerId } = req.validated.params;

    const player = PlayersService.getById(req.db, playerId);
    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    const transaction = PointsService.award(req.db, playerId, req.validated.body);
    res.status(201).json(transaction);
});

router.get("/players/:playerId/points/history", validate(getPointsHistorySchema), (req, res, next) => {
    const { playerId } = req.validated.params;

    const player = PlayersService.getById(req.db, playerId);
    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    const { limit, offset } = req.validated.query;

    const history = PointsService.getHistory(req.db, playerId, { limit, offset });
    res.status(200).json(history);
});

export default router;