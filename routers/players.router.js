import express from "express";
import { PlayersService } from "../services/players.service.js";
import { validate } from "../middleware/validate.middleware.js";
import { playerSearchSchema } from "../validators/players.validator.js";

const router = express.Router();

router.get("/search", validate(playerSearchSchema), (req, res) => {
    const players = PlayersService.findByName(req.db, req.validated.query.q);
    res.json(players);
});

export default router;