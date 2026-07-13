import express from "express";
import { MapTagsService } from "../services/map-tags.service.js";

const router = express.Router();

router.get("/", (req, res) => {
    const tags = MapTagsService.list(req.db);
    res.json(tags);
});

export default router;