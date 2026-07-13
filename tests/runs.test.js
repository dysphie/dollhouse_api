import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";

import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { TiersService } from "../services/tiers.service.js";
import { MapsService } from "../services/maps.service.js";
import { PlayersService } from "../services/players.service.js";
import { PerfTagsService } from "../services/run-tags.service.js";
import { MutatorsService } from "../services/mutators.service.js";
import { api } from "./helpers/api-client.js";
import { toEpochSeconds } from "../lib/epoch.js";

describe("Runs API", () => {
    let db;
    let app;
    let client;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);
    });

    test("creates a run", async () => {
        const tier = TiersService.upsert(db, { name: "Easy", description: "", points: 10, enabled: 1 });
        const map = MapsService.upsert(db, { filename: "test_map", stage: "", tierId: tier.id, enabled: 1 });
        const player = PlayersService.upsert(db, { steamId: "STEAM_0:1:123", name: "Tester" });

        const response = await request(app)
            .post("/runs")
            .send({
                playerId: player.id,
                sessionId: "abc",
                mapId: map.id,
                kills: 20,
                mutators: [],
                tags: [],
                weaponKills: []
            });

        expect(response.status).toBe(201);
    });

    test("rejects invalid runs", async () => {
        const response = await request(app)
            .post("/runs")
            .send({
                mapId: "invalid"
            });

        expect(response.status).toBe(400);
    });

    describe("GET /runs filters", async () => {
        let tierEasy, tierHard, mapA, mapB, playerX, playerY;
        let sessionCounter;
        let tagNoDamage, tagNoReload, tagPacifist, tagSpeedrun, tagSolo;
        let mutHardcore, mutPermadeath, mutFriendlyFire, mutNoHud, mutIronman;

        beforeEach(() => {
            tierEasy = TiersService.upsert(db, { name: "Easy", description: "", points: 10, enabled: 1 });
            tierHard = TiersService.upsert(db, { name: "Hard", description: "", points: 50, enabled: 1 });

            mapA = MapsService.upsert(db, { filename: "map_a", stage: "", tierId: tierEasy.id, enabled: 1 });
            mapB = MapsService.upsert(db, { filename: "map_b", stage: "", tierId: tierHard.id, enabled: 1 });

            playerX = PlayersService.upsert(db, { steamId: "STEAM_0:1:100", name: "PlayerX" });
            playerY = PlayersService.upsert(db, { steamId: "STEAM_0:1:200", name: "PlayerY" });

            tagNoDamage = PerfTagsService.upsert(db, { mapId: mapA.id, name: "no_damage", description: "", enabled: 1 });
            tagSolo = PerfTagsService.upsert(db, { mapId: mapA.id, name: "solo", description: "", enabled: 1 });
            tagPacifist = PerfTagsService.upsert(db, { mapId: mapB.id, name: "pacifist", description: "", enabled: 1 });
            tagSpeedrun = PerfTagsService.upsert(db, { mapId: mapB.id, name: "speedrun", description: "", enabled: 1 });
            tagNoReload = PerfTagsService.upsert(db, { mapId: mapA.id, name: "no_reload", description: "", enabled: 1 });

            mutHardcore = MutatorsService.upsert(db, { name: "hardcore", description: "", enabled: 1 });
            mutPermadeath = MutatorsService.upsert(db, { name: "permadeath", description: "", enabled: 1 });
            mutFriendlyFire = MutatorsService.upsert(db, { name: "friendly_fire", description: "", enabled: 1 });
            mutNoHud = MutatorsService.upsert(db, { name: "no_hud", description: "", enabled: 1 });
            mutIronman = MutatorsService.upsert(db, { name: "ironman", description: "", enabled: 1 });

            sessionCounter = 0;
        });

        const createRun = async (overrides = {}) => {
            sessionCounter += 1;

            const res = await request(app)
                .post("/runs")
                .send({
                    playerId: playerX.id,
                    sessionId: `session-${sessionCounter}`,
                    mapId: mapA.id,
                    kills: 0,
                    deaths: 0,
                    presencePercentage: 0,
                    mutators: [],
                    tags: [],
                    weaponKills: [],
                    ...overrides
                });

            expect(res.status).toBe(201);
            return res.body.runId;
        };

        const setTimestamp = (runId, isoString) => {
            db.prepare("UPDATE runs SET created_at = ? WHERE run_id = ?")
                .run(toEpochSeconds(isoString), runId);
        };

        const sessionIdsOf = (body) => body.map((r) => r.session_id);

        test("filters by playerId", async () => {
            await createRun({ playerId: playerX.id, sessionId: "px" });
            await createRun({ playerId: playerY.id, sessionId: "py" });

            const res = await client.get("/runs").query({ playerId: playerX.id });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body)).toEqual(["px"]);
        });

        test("filters by mapId", async () => {
            await createRun({ mapId: mapA.id, sessionId: "ma" });
            await createRun({ mapId: mapB.id, sessionId: "mb" });

            const res = await client.get("/runs").query({ mapId: mapB.id });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body)).toEqual(["mb"]);
        });

        test("filters by tierId (via joined map)", async () => {
            await createRun({ mapId: mapA.id, sessionId: "easy-run" });
            await createRun({ mapId: mapB.id, sessionId: "hard-run" });

            const res = await client.get("/runs").query({ tierId: tierHard.id });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body)).toEqual(["hard-run"]);
        });

        test("filters by minKills (inclusive boundary)", async () => {
            await createRun({ sessionId: "low", kills: 5 });
            await createRun({ sessionId: "exact", kills: 10 });
            await createRun({ sessionId: "high", kills: 15 });

            const res = await client.get("/runs").query({ minKills: 10 });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body).sort()).toEqual(["exact", "high"]);
        });

        test("filters by maxDeaths (inclusive boundary)", async () => {
            await createRun({ sessionId: "low", deaths: 0 });
            await createRun({ sessionId: "exact", deaths: 3 });
            await createRun({ sessionId: "high", deaths: 7 });

            const res = await client.get("/runs").query({ maxDeaths: 3 });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body).sort()).toEqual(["exact", "low"]);
        });

        test("filters by minPresence", async () => {
            await createRun({ sessionId: "low", presencePercentage: 40 });
            await createRun({ sessionId: "high", presencePercentage: 90 });

            const res = await client.get("/runs").query({ minPresence: 75 });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body)).toEqual(["high"]);
        });

        test("filters by after/before timestamp range", async () => {
            const early = await createRun({ sessionId: "early" });
            const middle = await createRun({ sessionId: "middle" });
            const late = await createRun({ sessionId: "late" });

            setTimestamp(early, "2024-01-01T00:00:00Z");
            setTimestamp(middle, "2024-06-01T00:00:00Z");
            setTimestamp(late, "2024-12-01T00:00:00Z");

            // "after" is treated as start-of-day, "before" is bumped to end-of-day by the
            // validator, so this range covers feb 1 - nov 1 (inclusive).
            const res = await client.get("/runs").query({
                after: "2024-02-01",
                before: "2024-11-01"
            });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body)).toEqual(["middle"]);
        });

        test("mutators filter requires an exact set match", async () => {
            await createRun({ sessionId: "exact-match", mutators: [mutHardcore.id, mutPermadeath.id] });
            await createRun({ sessionId: "subset", mutators: [mutHardcore.id] });
            await createRun({ sessionId: "superset", mutators: [mutHardcore.id, mutPermadeath.id, mutFriendlyFire.id] });
            await createRun({ sessionId: "different-set", mutators: [mutNoHud.id, mutIronman.id] });

            const res = await client.get("/runs").query({ mutators: [mutHardcore.id, mutPermadeath.id] });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body)).toEqual(["exact-match"]);
        });

        test("mutators filter excludes runs missing a requested mutator", async () => {
            await createRun({ sessionId: "has-one", mutators: [mutHardcore.id] });

            const res = await client.get("/runs").query({ mutators: [mutHardcore.id, mutPermadeath.id] });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body)).toEqual([]);
        });

        test("tags filter is inclusive: extra tags don't disqualify", async () => {
            await createRun({ sessionId: "exact", tags: [tagNoDamage.id, tagSolo.id] });
            await createRun({ sessionId: "has-extra", tags: [tagNoDamage.id, tagSolo.id, tagPacifist.id] });
            await createRun({ sessionId: "missing-one", tags: [tagNoDamage.id] });
            await createRun({ sessionId: "unrelated", tags: [tagSpeedrun.id] });

            const res = await client.get("/runs").query({ tags: [tagNoDamage.id, tagSolo.id] });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body).sort()).toEqual(["exact", "has-extra"]);
        });

        test("combines multiple filters with AND semantics", async () => {
            await createRun({
                sessionId: "matches-all",
                mapId: mapA.id,
                kills: 20,
                mutators: [1]
            });
            await createRun({
                sessionId: "wrong-map",
                mapId: mapB.id,
                kills: 20,
                mutators: [1]
            });
            await createRun({
                sessionId: "too-few-kills",
                mapId: mapA.id,
                kills: 5,
                mutators: [1]
            });

            const res = await client.get("/runs").query({
                mapId: mapA.id,
                minKills: 10,
                mutators: [1]
            });

            expect(res.status).toBe(200);
            expect(sessionIdsOf(res.body)).toEqual(["matches-all"]);
        });

        test("respects limit and offset for pagination", async () => {
            const first = await createRun({ sessionId: "first" });
            const second = await createRun({ sessionId: "second" });
            const third = await createRun({ sessionId: "third" });

            // ORDER BY timestamp DESC, so give each a distinct, known order.
            setTimestamp(first, "2024-01-01T00:00:00Z");
            setTimestamp(second, "2024-01-02T00:00:00Z");
            setTimestamp(third, "2024-01-03T00:00:00Z");

            const page = await client.get("/runs").query({ limit: 1, offset: 1 });

            expect(page.status).toBe(200);
            expect(sessionIdsOf(page.body)).toEqual(["second"]);
        });

        test("rejects malformed filter values", async () => {
            const res = await client.get("/runs").query({ mapId: "not-a-number" });

            expect(res.status).toBe(400);
        });
    });
});
