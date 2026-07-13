import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { PlayersService } from "../services/players.service.js";
import { MapsService } from "../services/maps.service.js";
import { WeaponsService } from "../services/weapons.service.js";
import { ChallengesService } from "../services/challenges.service.js";
import { api } from "./helpers/api-client.js";

describe("Weekly Challenges API", () => {
    let db;
    let app;
    let client;
    let player;
    let otherPlayer;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        player = PlayersService.upsert(db, {
            steamId: "STEAM_0:1:123",
            name: "Player"
        });

        otherPlayer = PlayersService.upsert(db, {
            steamId: "STEAM_0:1:456",
            name: "Other Player"
        });

        MapsService.upsert(db, { filename: "nmo_asylum", stage: "", tierId: null, enabled: 1 });
        WeaponsService.upsert(db, { className: "fa_1911", enabled: 1 });
    });

    test("generates a weekly set on first request", async () => {
        const res = await client.get(`/players/${player.id}/challenges/weekly`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
    });

    test("each challenge includes id, name, description, starts_at, expires_at, and completed_at", async () => {
        const res = await client.get(`/players/${player.id}/challenges/weekly`);

        expect(res.body[0]).toMatchObject({
            id: expect.any(Number),
            name: expect.any(String),
            description: expect.any(String),
            starts_at: expect.any(String),
            expires_at: expect.any(String),
            completed_at: null
        });
    });

    test("does not regenerate challenges on a repeat request within the same week", async () => {
        const first = await client.get(`/players/${player.id}/challenges/weekly`);
        const second = await client.get(`/players/${player.id}/challenges/weekly`);

        const firstIds = first.body.map((c) => c.id).sort();
        const secondIds = second.body.map((c) => c.id).sort();

        expect(secondIds).toEqual(firstIds);
    });

    test("returns 404 for an unknown player id", async () => {
        const res = await client.get("/challenges/999/weekly");

        expect(res.status).toBe(404);
    });

    test("reflects a player's completion status for individual challenges", async () => {
        const initial = await client.get(`/players/${player.id}/challenges/weekly`);
        const targetChallengeId = initial.body[0].id;

        ChallengesService.markCompleted(db, player.id, targetChallengeId);

        const res = await client.get(`/players/${player.id}/challenges/weekly`);

        const completed = res.body.find((c) => c.id === targetChallengeId);
        const others = res.body.filter((c) => c.id !== targetChallengeId);

        expect(completed.completed_at).not.toBeNull();
        others.forEach((c) => expect(c.completed_at).toBeNull());
    });

    test("resets globally, not per-player: different players see the same week's challenges", async () => {

        const first = await client.get(`/players/${player.id}/challenges/weekly`);
        const second = await client.get(`/players/${otherPlayer.id}/challenges/weekly`);

        const firstIds = first.body.map((c) => c.id).sort();
        const secondIds = second.body.map((c) => c.id).sort();

        expect(secondIds).toEqual(firstIds);
        expect(first.body[0].starts_at).toBe(second.body[0].starts_at);
        expect(first.body[0].expires_at).toBe(second.body[0].expires_at);
    });

    // test("still returns challenges when no maps or weapons exist to attach requirements to", async () => {
    //     db = new Database(":memory:");
    //     DatabaseService.initialize(db);
    //     app = createApp({ db });

    //     PlayersService.upsert(db, { steamId, name: "Player" });

    //     const res = await client.get(`/challenges/${steamId}/weekly`);

    //     expect(res.status).toBe(200);
    //     expect(res.body.length).toBeGreaterThan(0);
    // });
});

describe("ChallengesService.getCurrentWeekWindow", () => {
    test("anchors to the most recent Monday at 00:00:00 UTC", () => {
        const midWeek = new Date("2026-07-22T15:30:00Z");

        const window = ChallengesService.getCurrentWeekWindow(midWeek);

        expect(window.starts_at).toBe("2026-07-20T00:00:00.000Z");
        expect(window.expires_at).toBe("2026-07-27T00:00:00.000Z");
    });

    test("rolls Sunday back to the preceding Monday, not forward", () => {
        const sunday = new Date("2026-07-26T23:59:00Z");

        const window = ChallengesService.getCurrentWeekWindow(sunday);

        expect(window.starts_at).toBe("2026-07-20T00:00:00.000Z");
        expect(window.expires_at).toBe("2026-07-27T00:00:00.000Z");
    });

    test("returns a window that is exactly seven days wide", () => {
        const now = new Date();
        const window = ChallengesService.getCurrentWeekWindow(now);

        const spanMs = new Date(window.expires_at) - new Date(window.starts_at);

        expect(spanMs).toBe(7 * 24 * 60 * 60 * 1000);
    });
});