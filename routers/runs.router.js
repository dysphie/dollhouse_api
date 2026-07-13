import express from "express";
import { RunsService } from "../services/runs.service.js";
import { createRunSchema, runFiltersSchema, runIdSchema } from "../validators/runs.validator.js";
import { validate } from "../middleware/validate.middleware.js";

const router = express.Router();

router.get("/", validate(runFiltersSchema), (req, res) => {
    const runs = RunsService.search(req.db, req.validated.query);
    res.json(runs);
});

router.get("/:id", validate(runIdSchema), (req, res) => {
    const run = RunsService.getById(req.db, req.validated.params.id);

    if (!run) {
        return res.status(404).json({ error: "Run not found" });
    }

    res.json(run);
});

router.post("/", validate(createRunSchema, "body"), (req, res) => {
    const runId = RunsService.insert(req.db, req.validated.body);
    res.status(201).json({ runId });
});

export default router;