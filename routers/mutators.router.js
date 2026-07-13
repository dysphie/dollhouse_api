import express from "express";
import { validate } from "../middleware/validate.middleware.js";
import { MutatorsService } from "../services/mutators.service.js";

const router = express.Router();

router.get("/", (req, res) => {
    const mutators = MutatorsService.list(req.db);
    res.json(mutators);
});

export default router;