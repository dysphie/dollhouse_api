import express from "express";
import { PerfTagsService } from "../services/run-tags.service.js";

const router = express.Router();

router.get("/", (req, res) => {
    const tags = PerfTagsService.list(req.db);
    res.json(tags);
});

export default router;