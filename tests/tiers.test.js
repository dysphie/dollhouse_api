import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { TiersService } from "../services/tiers.service.js";
import { api } from "./helpers/api-client.js";

describe("Tiers API", () => {
    let db;
    let app;
    let client;
    let tierBronze, tierSilver, tierGold;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        tierBronze = TiersService.upsert(db, {
            name: "bronze",
            description: "Bronze tier",
            points: 100,
            enabled: 1
        });

        tierSilver = TiersService.upsert(db, {
            name: "silver",
            description: "Silver tier",
            points: 200,
            enabled: 1
        });

        tierGold = TiersService.upsert(db, {
            name: "gold",
            description: "Gold tier",
            points: 300,
            enabled: 1
        });
    });

    test("lists all tiers", async () => {
        const res = await client.get("/tiers");

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
    });

    test("orders tiers by points ascending", async () => {
        const res = await client.get("/tiers");

        expect(res.status).toBe(200);
        expect(res.body.map((t) => t.name)).toEqual([
            "bronze",
            "silver",
            "gold"
        ]);
    });

    test("excludes disabled tiers in list", async () => {
        TiersService.upsert(db, {
            name: "bronze",
            description: "Bronze tier",
            points: 100,
            enabled: 0
        });

        const res = await client.get("/tiers");

        expect(res.status).toBe(200);
        expect(res.body.map((t) => t.name)).not.toContain("bronze");
    });

    test("returns an empty array when no tiers exist", async () => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        const res = await client.get("/tiers");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test("each tier includes id, name, description, points, and enabled", async () => {
        const res = await client.get("/tiers");

        expect(res.status).toBe(200);
        expect(res.body[0]).toMatchObject({
            id: expect.any(Number),
            name: expect.any(String),
            description: expect.any(String),
            points: expect.any(Number),
            enabled: 1
        });
    });
});