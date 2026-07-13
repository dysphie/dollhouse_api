import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { PlayersService } from "../services/players.service.js";

describe("Players Search API", () => {
    let db;
    let app;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });

        PlayersService.upsert(db, { steamId: "STEAM_0:1:100", name: "Alice" });
        PlayersService.upsert(db, { steamId: "STEAM_0:1:200", name: "Alicia" });
        PlayersService.upsert(db, { steamId: "STEAM_0:1:300", name: "Bob" });
    });

    test("searches players by partial name", async () => {
        const res = await request(app)
            .get("/players/search")
            .query({ q: "Ali" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body.map((p) => p.name)).toEqual(
            expect.arrayContaining(["Alice", "Alicia"])
        );
    });

    test("returns an empty array when no players match", async () => {
        const res = await request(app)
            .get("/players/search")
            .query({ q: "Nobody" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test("search is case insensitive", async () => {
        const res = await request(app)
            .get("/players/search")
            .query({ q: "alice" });

        expect(res.status).toBe(200);
        expect(res.body.map((p) => p.name)).toContain("Alice");
    });

    test("requires q parameter", async () => {
        const res = await request(app)
            .get("/players/search");

        expect(res.status).toBe(400);
    });

    test("returns players with expected fields", async () => {
        const res = await request(app)
            .get("/players/search")
            .query({ q: "Alice" });

        expect(res.status).toBe(200);
        expect(res.body[0]).toMatchObject({
            id: expect.any(Number),
            name: expect.any(String)
        });
    });
});