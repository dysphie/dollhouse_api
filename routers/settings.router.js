import express from "express";
import { SettingsService } from "../services/settings.service.js";
import { validate } from "../middleware/validate.middleware.js";
import { updateSettingsSchema, getSettingsSchema } from "../validators/settings.validator.js";
import { PlayersService } from "../services/players.service.js";

const router = express.Router();

router.get("/players/:playerId/settings", validate(getSettingsSchema), (req, res) => {
    const settings = SettingsService.getByPlayerId(req.db, req.validated.params.playerId);

    if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
    }

    res.json(settings);
});

router.patch("/players/:playerId/settings", validate(updateSettingsSchema), (req, res) => {
    const playerId = req.validated.params.playerId;

    const player = PlayersService.getById(req.db, playerId);
    if (!player) {
        return res.status(404).json({
            error: "Player not found"
        });
    }

    const updated = SettingsService.update(req.db, playerId, req.validated.body);
    res.json(updated);
});

export default router;