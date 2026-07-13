import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { MapsService } from "../services/maps.service.js";
import { TiersService } from "../services/tiers.service.js";
import { api } from "./helpers/api-client.js";

describe("Maps API", () => {
    let db;
    let app;
    let tier;
    let client;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        tier = TiersService.upsert(db, {
            name: "easy",
            points: 5,
            enabled: 1
        });

        MapsService.upsert(db, {
            filename: "surf_beginner",
            stage: "0",
            tierId: tier.id,
            enabled: 1
        });

        MapsService.upsert(db, {
            filename: "surf_utopia",
            stage: "1",
            tierId: tier.id,
            enabled: 1
        });

        MapsService.upsert(db, {
            filename: "bhop_easy",
            stage: "0",
            tierId: tier.id,
            enabled: 1
        });
    });

    test("lists all enabled maps", async () => {
        const res = await client.get("/maps");

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
    });

    test("excludes disabled maps", async () => {
        MapsService.upsert(db, {
            filename: "surf_beginner",
            stage: "0",
            tierId: tier.id,
            enabled: 0
        });

        const res = await client.get("/maps");

        expect(res.status).toBe(200);
        expect(
            res.body.some(
                (m) => m.filename === "surf_beginner" && m.stage === "0"
            )
        ).toBe(false);

        expect(res.body).toHaveLength(2);
    });

    test("returns an empty array when no maps exist", async () => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        const res = await client.get("/maps");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test("each map includes id, filename, stage, enabled, and tier_id", async () => {
        const res = await client.get("/maps");

        expect(res.status).toBe(200);
        expect(res.body[0]).toMatchObject({
            id: expect.any(Number),
            filename: expect.any(String),
            stage: expect.any(String),
            enabled: 1,
            tier_id: expect.any(Number)
        });
    });

    test("maps are ordered by filename then stage", async () => {
        const res = await client.get("/maps");

        expect(res.status).toBe(200);
        expect(res.body.map((m) => `${m.filename}:${m.stage}`)).toEqual([
            "bhop_easy:0",
            "surf_beginner:0",
            "surf_utopia:1"
        ]);
    });
});