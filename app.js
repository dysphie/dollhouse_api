import "dotenv/config";

import express from "express";
import Database from "better-sqlite3";

import { DatabaseService } from "./services/database.service.js";

import runsRouter from "./routers/runs.router.js";
import mutatorsRouter from "./routers/mutators.router.js";
import runTagsRouter from "./routers/run-tags.router.js";
import mapTagsRouter from "./routers/map-tags.router.js";
import leaderboardsRouter from "./routers/leaderboards.router.js";
import pointsRouter from "./routers/points.router.js";
import blocksRouter from "./routers/blocks.router.js";
import challengesRouter from "./routers/challenges.router.js";
import playersRouter from "./routers/players.router.js";
import tiersRouter from "./routers/tiers.router.js";
import settingsRouter from "./routers/settings.router.js";
import mapsRouter from "./routers/maps.router.js";
import matchesRouter from "./routers/matches.router.js"

import { rateLimit, MINUTE } from 'express-rate-limit'
import cors from 'cors';
import { logger } from "./middleware/logger.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";

const limiter = rateLimit({
    windowMs: 15 * MINUTE,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56
})

export const createApp = ({ db } = {}) => {
    const app = express();

    if (process.env.NODE_ENV !== "test") {
        app.use(limiter);
    }

    app.use(logger);
    app.use(cors());
    app.use(express.json());

    const database = db ?? new Database("./db.sqlite3");

    if (!db) {
        DatabaseService.initialize(database);
    }

    app.locals.db = database;

    app.use((req, res, next) => {
        req.db = database;
        next();
    });

    app.use("/matches", matchesRouter);
    app.use("/maps", mapsRouter);
    app.use("/runs", runsRouter);
    app.use("/mutators", mutatorsRouter);
    app.use("/tiers", tiersRouter);
    app.use("/run-tags", runTagsRouter);
    app.use("/map-tags", mapTagsRouter);
    app.use("/leaderboards", leaderboardsRouter);
    app.use("/", pointsRouter);
    app.use("/", blocksRouter);
    app.use("/", challengesRouter);
    app.use("/players", playersRouter);
    app.use("/", settingsRouter);
    app.use(errorHandler);

    return app;
};