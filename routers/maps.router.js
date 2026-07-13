import express from "express";
import { MapsService } from "../services/maps.service.js";

const router = express.Router();

router.get("/", (req, res) => {
    const maps = MapsService.list(req.db);
    res.json(maps);
});

export default router;