import "dotenv/config";
import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { PlayersService } from "../services/players.service.js";
import { TiersService } from "../services/tiers.service.js";
import { MapsService } from "../services/maps.service.js";
import { RunsService } from "../services/runs.service.js";
import { api } from "./helpers/api-client.js";

describe("Points API", () => {
    let db;
    let app;
    let client;
    let playerId;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        playerId = PlayersService.upsert(db, {
            steamId: "STEAM_0:1:123",
            name: "Tester"
        }).id;
    });

    test("awards points to a player", async () => {
        const res = await client.post(`/players/${playerId}/points`).set("x-server-key", process.env.SERVER_API_KEY)
            .send({
                points: 100,
                transaction_type: "bonus",
                reason: "Weekly reward"
            });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            player_id: playerId,
            points: 100,
            transaction_type: "bonus",
            reason: "Weekly reward",
            run_id: null
        });
    });

    test("allows negative points", async () => {
        const res = await client.post(`/players/${playerId}/points`).set("x-server-key", process.env.SERVER_API_KEY)
            .send({
                points: -50,
                transaction_type: "penalty",
                reason: "Replay invalidated"
            });

        expect(res.status).toBe(201);
        expect(res.body.points).toBe(-50);
    });

    test("stores run_id when provided", async () => {
        const tier = TiersService.upsert(db, {
            name: "Easy",
            description: "",
            points: 10,
            enabled: 1
        });

        const map = MapsService.upsert(db, {
            filename: "test_map",
            stage: "",
            tierId: tier.id,
            enabled: 1
        });

        const runId = RunsService.insert(db, {
            playerId,
            sessionId: "session",
            mapId: map.id,
            damageTaken: 0,
            zombieDamageTaken: 0,
            zombieDamageDealt: 0,
            kills: 0,
            deaths: 0,
            presencePercentage: 100,
            extractionTime: 12345,
            replayId: "replay.dem",
            mutators: [],
            tags: [],
            weaponKills: []
        });

        const res = await client.post(`/players/${playerId}/points`).set("x-server-key", process.env.SERVER_API_KEY)
            .send({
                points: 25,
                transaction_type: "run_completion",
                reason: "Completed map",
                run_id: runId
            });

        expect(res.status).toBe(201);
    });

    test("rejects an invalid transaction type", async () => {
        const res = await client.post(`/players/${playerId}/points`).set("x-server-key", process.env.SERVER_API_KEY)
            .send({
                points: 100,
                transaction_type: "cheating",
                reason: "Invalid transaction"
            });

        expect(res.status).toBe(400);
    });

    test("rejects an empty reason", async () => {
        const res = await client.post(`/players/${playerId}/points`).set("x-server-key", process.env.SERVER_API_KEY)
            .send({
                points: 100,
                transaction_type: "bonus",
                reason: ""
            });

        expect(res.status).toBe(400);
    });

    test("rejects a missing player_id", async () => {
        const res = await client.post("/players//points").set("x-server-key", process.env.SERVER_API_KEY)
            .send({
                points: 100,
                transaction_type: "bonus",
                reason: "Weekly reward"
            });

        expect(res.status).toBe(404);
    });
});