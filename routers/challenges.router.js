import express from "express";
import { ChallengesService } from "../services/challenges.service.js";
import { PlayersService } from "../services/players.service.js";
import { weeklyChallengesSchema } from "../validators/challenges.validator.js";
import { validate } from "../middleware/validate.middleware.js";
import { requireServerKey } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/players/:playerId/challenges/weekly", requireServerKey, validate(weeklyChallengesSchema), (req, res) => {
    const { playerId } = req.params;

    const player = PlayersService.getById(req.db, playerId);
    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    const challenges = ChallengesService.getWeeklyForPlayer(req.db, player.id);

    if (!challenges) {
        return res.sendStatus(500);
    }

    res.json(challenges);
});

export default router;
