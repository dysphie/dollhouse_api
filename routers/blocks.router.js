
import express from "express";
import { validate } from "../middleware/validate.middleware.js";
import { getCommunicationBlocksSchema, updateCommunicationBlocksSchema } from "../validators/blocks.validator.js";
import { CommunicationBlocksService } from "../services/blocks.service.js";
import { PlayersService } from "../services/players.service.js";
import { requireServerKey } from "../middleware/auth.middleware.js";

const router = express.Router();

router.put("/players/:playerId/blocks/:targetPlayerId", requireServerKey, validate(updateCommunicationBlocksSchema), (req, res) => {
    const { playerId, targetPlayerId } = req.validated.params;

    const player = PlayersService.getById(req.db, playerId);
    const targetPlayer = PlayersService.getById(req.db, targetPlayerId);
    
    if (!player || !targetPlayer) {
        return res.status(404).json({ error: "Player not found" });
    }

    CommunicationBlocksService.update(
        req.db,
        playerId,
        targetPlayerId,
        req.validated.body
    );

    res.sendStatus(204);
});

router.get("/players/:playerId/blocks", requireServerKey, validate(getCommunicationBlocksSchema), (req, res) => {
    const { playerId } = req.validated.params;
    const player = PlayersService.getById(req.db, playerId);
    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    const blocks = CommunicationBlocksService.get(req.db, playerId);
    res.status(200).json(blocks);
});

export default router;