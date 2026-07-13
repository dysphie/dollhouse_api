import express from "express";
import { matchesFiltersSchema } from "../validators/matches.validator.js";
import { validate } from "../middleware/validate.middleware.js";
import { MatchesService } from "../services/matches.service.js";

const router = express.Router();

router.get("/", validate(matchesFiltersSchema), (req, res) => {
    const { mapId, mutators, player, limit, offset } = req.validated.query;
    
    const result = MatchesService.search(req.db, {
        mapId,
        mutators,
        player,
        limit,
        offset
    });
    res.json(result);
});

export default router;