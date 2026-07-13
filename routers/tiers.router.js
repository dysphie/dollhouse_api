import express from "express";
import { validate } from "../middleware/validate.middleware.js";
import { TiersService } from "../services/tiers.service.js";

const router = express.Router();

router.get("/", (req, res) => {
    const tiers = TiersService.list(req.db);
    res.json(tiers);
});

export default router;