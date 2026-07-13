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

describe("Leaderboards API", () => {
    let db;
    let app;
    let client;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);
    });

    describe("GET /leaderboards/map/:mapId/fastest", () => {
        let map, tier, player1, player2, player3;
        let tagNoDamage, tagSolo;
        let mutHardcore, mutPermadeath;

        beforeEach(() => {
            tier = TiersService.upsert(db, { name: "Easy", description: "", points: 10, enabled: 1 });
            map = MapsService.upsert(db, { filename: "test_map", stage: "", tierId: tier.id, enabled: 1 });
            player1 = PlayersService.upsert(db, { steamId: "STEAM_0:1:100", name: "PlayerOne" });
            player2 = PlayersService.upsert(db, { steamId: "STEAM_0:1:200", name: "PlayerTwo" });
            player3 = PlayersService.upsert(db, { steamId: "STEAM_0:1:300", name: "PlayerThree" });
            tagNoDamage = PerfTagsService.upsert(db, { mapId: null, name: "no_damage", description: "", enabled: 1 });
            tagSolo = PerfTagsService.upsert(db, { mapId: null, name: "solo", description: "", enabled: 1 });
            mutHardcore = MutatorsService.upsert(db, { name: "hardcore", description: "", enabled: 1 });
            mutPermadeath = MutatorsService.upsert(db, { name: "permadeath", description: "", enabled: 1 });
        });

        const createRun = async (overrides = {}) => {
            const res = await client.post("/runs")
                .send({
                    playerId: player1.id,
                    sessionId: `session-${Date.now()}-${Math.random()}`,
                    mapId: map.id,
                    kills: 0,
                    deaths: 0,
                    presencePercentage: 100,
                    extractionTime: 120, // default 2 minutes
                    mutators: [],
                    tags: [],
                    weaponKills: [],
                    ...overrides
                });

            expect(res.status).toBe(201);
            return res.body.runId;
        };

        const setTimestamp = (runId, isoString) => {
            const seconds = toEpochSeconds(isoString)
            db.prepare("UPDATE runs SET created_at = ? WHERE run_id = ?").run(seconds, runId);
        };

        test("returns fastest extraction time per player on a map", async () => {
            await createRun({ playerId: player1.id, extractionTime: 90, sessionId: "p1-fast" }); // player1: fastest time
            await createRun({ playerId: player1.id, extractionTime: 95, sessionId: "p1-slow" });
            await createRun({ playerId: player2.id, extractionTime: 100, sessionId: "p2" }); // player2: medium time
            await createRun({ playerId: player3.id, extractionTime: 120, sessionId: "p3" });// player3: slowest time

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);
            expect(res.body[0]).toMatchObject({ player_id: player1.id, player_name: "PlayerOne", best_time: 90 });
            expect(res.body[1]).toMatchObject({ player_id: player2.id, best_time: 100 });
            expect(res.body[2]).toMatchObject({ player_id: player3.id, best_time: 120 });
        });

        test("only includes runs with extraction_time not null", async () => {
            await createRun({
                playerId: player1.id,
                extractionTime: 90,
                sessionId: "with-time"
            });
            await createRun({
                playerId: player2.id,
                extractionTime: null,
                sessionId: "no-time"
            });

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].player_id).toBe(player1.id);
        });

        test("ties broken by earliest created_at", async () => {
            const run1 = await createRun({
                playerId: player1.id,
                extractionTime: 100,
                sessionId: "first-tie"
            });
            const run2 = await createRun({
                playerId: player2.id,
                extractionTime: 100,
                sessionId: "second-tie"
            });

            setTimestamp(run1, "2024-01-01T00:00:00Z");
            setTimestamp(run2, "2024-01-02T00:00:00Z");

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].player_id).toBe(player1.id);
            expect(res.body[1].player_id).toBe(player2.id);
        });

        test("filters by mutators (exact set match)", async () => {
            await createRun({ playerId: player2.id, extractionTime: 50, mutators: [mutHardcore.id] });
            await createRun({ playerId: player3.id, extractionTime: 60, mutators: [] });
            const expected = await createRun({ playerId: player1.id, extractionTime: 70, mutators: [mutHardcore.id, mutPermadeath.id] });

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ mutators: [mutHardcore.id, mutPermadeath.id] });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].run_id).toBe(expected);
        });

        test("filters by tags (inclusive)", async () => {
            const expected = await createRun({ playerId: player1.id, extractionTime: 90, tags: [tagNoDamage.id, tagSolo.id] });
            await createRun({ playerId: player2.id, extractionTime: 100, tags: [tagNoDamage.id, tagSolo.id], });
            await createRun({ playerId: player3.id, extractionTime: 110, tags: [tagNoDamage.id] });

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ tags: [tagNoDamage.id, tagSolo.id] });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].run_id).toBe(expected);
        });

        test("respects limit and offset for pagination", async () => {
            await createRun({ playerId: player1.id, extractionTime: 90 });
            const expected = await createRun({ playerId: player2.id, extractionTime: 100 });
            await createRun({ playerId: player3.id, extractionTime: 110 });

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ limit: 1, offset: 1 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].run_id).toBe(expected);
        });

        // FIXME
        // test("rejects invalid mapId", async () => {
        //     const res = await client.get("/leaderboards/map/invalid/fastest");

        //     expect(res.status).toBe(400);
        // });
    });

    describe("GET /leaderboards/records", () => {
        let map1, map2, map3, tier;
        let player1, player2;
        let mutator;

        beforeEach(() => {
            tier = TiersService.upsert(db, {
                name: "Easy",
                description: "",
                points: 10,
                enabled: 1
            });

            map1 = MapsService.upsert(db, {
                filename: "map1",
                stage: "",
                tierId: tier.id,
                enabled: 1
            });
            map2 = MapsService.upsert(db, {
                filename: "map2",
                stage: "",
                tierId: tier.id,
                enabled: 1
            });
            map3 = MapsService.upsert(db, {
                filename: "map3",
                stage: "",
                tierId: tier.id,
                enabled: 1
            });

            player1 = PlayersService.upsert(db, {
                steamId: "STEAM_0:1:100",
                name: "RecordHolder"
            });
            player2 = PlayersService.upsert(db, {
                steamId: "STEAM_0:1:200",
                name: "Challenger"
            });

            mutator = MutatorsService.upsert(db, {
                name: "test_mutator",
                description: "",
                enabled: 1
            });
        });

        const createRun = async (mapId, playerId, extractionTime, overrides = {}) => {
            const res = await client.post("/runs")
                .send({
                    playerId,
                    sessionId: `session-${Date.now()}-${Math.random()}`,
                    mapId,
                    kills: 0,
                    deaths: 0,
                    presencePercentage: 100,
                    extractionTime,
                    mutators: [],
                    tags: [],
                    weaponKills: [],
                    ...overrides
                });

            expect(res.status).toBe(201);
            return res.body.runId;
        };

        test("ranks players by number of map records held", async () => {
            // player1 holds records on map1 and map2
            await createRun(map1.id, player1.id, 90);
            await createRun(map2.id, player1.id, 100);
            await createRun(map3.id, player2.id, 80); // player2 holds map3

            // player2 also has slower times on map1 and map2
            await createRun(map1.id, player2.id, 95);
            await createRun(map2.id, player2.id, 105);

            const res = await client.get("/leaderboards/records");

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0]).toMatchObject({
                player_id: player1.id,
                player_name: "RecordHolder",
                record_count: 2
            });
            expect(res.body[1]).toMatchObject({
                player_id: player2.id,
                player_name: "Challenger",
                record_count: 1
            });
        });

        test("counts shared fastest times as records for all tied players", async () => {
            await createRun(map1.id, player1.id, 100); // player1 has 1 record
            await createRun(map1.id, player2.id, 100); // player2 has 1 record
            await createRun(map2.id, player1.id, 80); // player1 has 2 records
            await createRun(map2.id, player2.id, 90);

            const res = await client.get("/leaderboards/records");

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].player_id).toBe(player1.id);
            expect(res.body[1].player_id).toBe(player2.id);
        });

        test("filters by mutators and tags", async () => {
            await createRun(map1.id, player1.id, 90, {
                mutators: [mutator.id]
            });
            await createRun(map2.id, player2.id, 100, {
                mutators: [mutator.id]
            });

            await createRun(map3.id, player1.id, 80);

            const res = await client.get("/leaderboards/records")
                .query({ mutators: [mutator.id] });

            expect(res.status).toBe(200);
            const totalRecords = res.body.reduce((sum, p) => sum + p.record_count, 0);
            expect(totalRecords).toBe(2); // only maps w/ mutator
        });

        test("respects limit and offset for pagination", async () => {
            await createRun(map1.id, player1.id, 90);
            await createRun(map2.id, player2.id, 100);

            const res = await client.get("/leaderboards/records")
                .query({ limit: 1, offset: 0 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            // should be sorted by record_count DESC, so whoever has more records
            // since each has 1 record, order is arbitrary but stable
        });
    });

    describe("GET /leaderboards/extractions", () => {
        let map1, map2, map3, tier;
        let player1, player2, player3;
        let mutator;

        beforeEach(() => {
            tier = TiersService.upsert(db, {
                name: "Easy",
                description: "",
                points: 10,
                enabled: 1
            });

            map1 = MapsService.upsert(db, {
                filename: "map1",
                stage: "",
                tierId: tier.id,
                enabled: 1
            });
            map2 = MapsService.upsert(db, {
                filename: "map2",
                stage: "",
                tierId: tier.id,
                enabled: 1
            });
            map3 = MapsService.upsert(db, {
                filename: "map3",
                stage: "",
                tierId: tier.id,
                enabled: 1
            });

            player1 = PlayersService.upsert(db, {
                steamId: "STEAM_0:1:100",
                name: "Explorer"
            });
            player2 = PlayersService.upsert(db, {
                steamId: "STEAM_0:1:200",
                name: "Grinder"
            });
            player3 = PlayersService.upsert(db, {
                steamId: "STEAM_0:1:300",
                name: "Casual"
            });

            mutator = MutatorsService.upsert(db, {
                name: "test_mutator",
                description: "",
                enabled: 1
            });
        });

        const createRun = async (mapId, playerId, overrides = {}) => {
            const res = await client.post("/runs")
                .send({
                    playerId,
                    sessionId: `session-${Date.now()}-${Math.random()}`,
                    mapId,
                    kills: 0,
                    deaths: 0,
                    presencePercentage: 100,
                    extractionTime: 120,
                    mutators: [],
                    tags: [],
                    weaponKills: [],
                    ...overrides
                });

            expect(res.status).toBe(201);
            return res.body.runId;
        };

        test("counts distinct maps extracted per player", async () => {
            // Player1 extracted on all 3 maps
            await createRun(map1.id, player1.id);
            await createRun(map2.id, player1.id);
            await createRun(map3.id, player1.id);

            // Player2 extracted on 2 maps
            await createRun(map1.id, player2.id);
            await createRun(map2.id, player2.id);

            // Player3 extracted on 1 map
            await createRun(map1.id, player3.id);

            const res = await client.get("/leaderboards/extractions");

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);
            expect(res.body[0]).toMatchObject({
                player_id: player1.id,
                player_name: "Explorer",
                extraction_count: 3
            });
            expect(res.body[1]).toMatchObject({
                player_id: player2.id,
                player_name: "Grinder",
                extraction_count: 2
            });
            expect(res.body[2]).toMatchObject({
                player_id: player3.id,
                player_name: "Casual",
                extraction_count: 1
            });
        });

        test("does not count duplicate extractions on same map", async () => {
            // Player1 has 3 runs on map1
            await createRun(map1.id, player1.id);
            await createRun(map1.id, player1.id);
            await createRun(map1.id, player1.id);

            // Player1 has 1 run on map2
            await createRun(map2.id, player1.id);

            const res = await client.get("/leaderboards/extractions");

            expect(res.status).toBe(200);
            expect(res.body[0].extraction_count).toBe(2);
        });

        test("only counts runs with extraction_time not null", async () => {
            await createRun(map1.id, player1.id, { extractionTime: 120 });
            await createRun(map2.id, player1.id, { extractionTime: null });
            await createRun(map3.id, player1.id, { extractionTime: null });

            const res = await client.get("/leaderboards/extractions");

            expect(res.status).toBe(200);
            expect(res.body[0].extraction_count).toBe(1);
        });

        test("filters by mutators and tags", async () => {
            await createRun(map1.id, player1.id, { mutators: [mutator.id] });
            await createRun(map2.id, player1.id, { mutators: [mutator.id] });

            await createRun(map3.id, player1.id);

            const res = await client.get("/leaderboards/extractions")
                .query({ mutators: [mutator.id] });

            expect(res.status).toBe(200);
            expect(res.body[0].extraction_count).toBe(2);
        });

        test("respects limit and offset for pagination", async () => {
            await createRun(map1.id, player1.id);
            await createRun(map2.id, player2.id);
            await createRun(map3.id, player3.id);

            const res = await client.get("/leaderboards/extractions")
                .query({ limit: 1, offset: 1 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
        });
    });

    describe("Filter validation", () => {
        let map, tier, player;

        beforeEach(() => {
            tier = TiersService.upsert(db, {
                name: "Easy",
                description: "",
                points: 10,
                enabled: 1
            });

            map = MapsService.upsert(db, {
                filename: "test_map",
                stage: "",
                tierId: tier.id,
                enabled: 1
            });

            player = PlayersService.upsert(db, {
                steamId: "STEAM_0:1:100",
                name: "Tester"
            });
        });

        test("rejects invalid limit values", async () => {
            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ limit: -1 });

            expect(res.status).toBe(400);
        });

        test("rejects invalid offset values", async () => {
            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ offset: -5 });

            expect(res.status).toBe(400);
        });

        test("rejects non-numeric playerId", async () => {
            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ playerId: "invalid" });

            expect(res.status).toBe(400);
        });

        test("accepts comma-separated mutators as string", async () => {
            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ mutators: "1,2,3" });

            expect(res.status).toBe(200);
        });

        test("accepts comma-separated tags as string", async () => {
            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ tags: "1,2,3" });

            expect(res.status).toBe(200);
        });
    });

    describe("GET /leaderboards/map/:mapId/fastest (player-centered)", () => {
        let map, tier, player1, player2, player3, player4, player5, player6;

        beforeEach(() => {
            tier = TiersService.upsert(db, { name: "Easy", description: "", points: 10, enabled: 1 });
            map = MapsService.upsert(db, { filename: "test_map", stage: "", tierId: tier.id, enabled: 1 });
            [player1, player2, player3, player4, player5, player6] = ["100", "200", "300", "400", "500", "600"]
                .map((id, i) => PlayersService.upsert(db, { steamId: `STEAM_0:1:${id}`, name: `Player${i + 1}` }));
        });

        const createRun = async (playerId, extractionTime, overrides = {}) => {
            const res = await client.post("/runs")
                .send({
                    playerId,
                    sessionId: `session-${Date.now()}-${Math.random()}`,
                    mapId: map.id,
                    kills: 0,
                    deaths: 0,
                    presencePercentage: 100,
                    extractionTime,
                    mutators: [],
                    tags: [],
                    weaponKills: [],
                    ...overrides
                });

            expect(res.status).toBe(201);
            return res.body.runId;
        };

        test("returns players immediately above and below the target player", async () => {
            // ranks: p1=90, p2=100, p3=110, p4=120, p5=130, p6=140
            await createRun(player1.id, 90);
            await createRun(player2.id, 100);
            await createRun(player3.id, 110);
            await createRun(player4.id, 120);
            await createRun(player5.id, 130);
            await createRun(player6.id, 140);

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ playerId: player4.id, context: 1 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);
            expect(res.body.map(r => r.player_id)).toEqual([player3.id, player4.id, player5.id]);
        });

        test("truncates window at the top of the leaderboard", async () => {
            await createRun(player1.id, 90);
            await createRun(player2.id, 100);
            await createRun(player3.id, 110);

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ playerId: player1.id, context: 5 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);
            expect(res.body[0].player_id).toBe(player1.id);
        });

        test("truncates window at the bottom of the leaderboard", async () => {
            await createRun(player1.id, 90);
            await createRun(player2.id, 100);
            await createRun(player3.id, 110);

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ playerId: player3.id, context: 5 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);
            expect(res.body[res.body.length - 1].player_id).toBe(player3.id);
        });

        test("defaults context window size when not specified", async () => {
            for (let i = 0; i < 6; i++) {
                await createRun([player1, player2, player3, player4, player5, player6][i].id, 90 + i * 10);
            }

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ playerId: player3.id });

            expect(res.status).toBe(200);
            // default context of 5 each side, but only 6 players total, so full list
            expect(res.body).toHaveLength(6);
        });

        test("returns 404 when target player has no qualifying run", async () => {
            await createRun(player1.id, 90);

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ playerId: player2.id });

            expect(res.status).toBe(404);
        });

        test("respects mutator/tag filters when windowing", async () => {
            const mutHardcore = MutatorsService.upsert(db, { name: "hardcore", description: "", enabled: 1 });

            const excluded = await createRun(player1.id, 90); // no mutator, would otherwise rank #1
            await createRun(player2.id, 100, { mutators: [mutHardcore.id] });
            await createRun(player3.id, 110, { mutators: [mutHardcore.id] });

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ playerId: player2.id, mutators: [mutHardcore.id], context: 5 });

            expect(res.status).toBe(200);
            expect(res.body.map(r => r.run_id)).not.toContain(excluded);
            expect(res.body).toHaveLength(2);
        });

        test("ignores limit/offset when player-centered window is requested", async () => {
            await createRun(player1.id, 90);
            await createRun(player2.id, 100);
            await createRun(player3.id, 110);

            const res = await client.get(`/leaderboards/map/${map.id}/fastest`)
                .query({ playerId: player2.id, context: 5, limit: 1, offset: 0 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);
        });
    });

    describe("GET /leaderboards/records (player-centered)", () => {
        let map1, map2, map3, tier, player1, player2, player3;

        beforeEach(() => {
            tier = TiersService.upsert(db, { name: "Easy", description: "", points: 10, enabled: 1 });
            map1 = MapsService.upsert(db, { filename: "map1", stage: "", tierId: tier.id, enabled: 1 });
            map2 = MapsService.upsert(db, { filename: "map2", stage: "", tierId: tier.id, enabled: 1 });
            map3 = MapsService.upsert(db, { filename: "map3", stage: "", tierId: tier.id, enabled: 1 });
            player1 = PlayersService.upsert(db, { steamId: "STEAM_0:1:100", name: "PlayerOne" });
            player2 = PlayersService.upsert(db, { steamId: "STEAM_0:1:200", name: "PlayerTwo" });
            player3 = PlayersService.upsert(db, { steamId: "STEAM_0:1:300", name: "PlayerThree" });
        });

        const createRun = async (mapId, playerId, extractionTime) => {
            const res = await client.post("/runs")
                .send({
                    playerId,
                    sessionId: `session-${Date.now()}-${Math.random()}`,
                    mapId,
                    kills: 0,
                    deaths: 0,
                    presencePercentage: 100,
                    extractionTime,
                    mutators: [],
                    tags: [],
                    weaponKills: [],
                });

            expect(res.status).toBe(201);
            return res.body.runId;
        };

        test("windows record-count leaderboard around a player", async () => {
            // player1 holds 2 records, player2 holds 1, player3 holds 0
            await createRun(map1.id, player1.id, 50);
            await createRun(map2.id, player1.id, 50);
            await createRun(map3.id, player2.id, 50);
            await createRun(map1.id, player3.id, 200); // no record

            const res = await client.get("/leaderboards/records")
                .query({ playerId: player2.id, context: 1 });

            expect(res.status).toBe(200);
            expect(res.body.map(r => r.player_id)).toContain(player2.id);
            expect(res.body.some(r => r.player_id === player1.id)).toBe(true);
        });

        test("returns 404 when player holds no records", async () => {
            await createRun(map1.id, player1.id, 50);

            const res = await client.get("/leaderboards/records")
                .query({ playerId: player3.id });

            expect(res.status).toBe(404);
        });
    });

    describe("GET /leaderboards/extractions (player-centered)", () => {
        let map1, map2, map3, tier, player1, player2, player3;

        beforeEach(() => {
            tier = TiersService.upsert(db, { name: "Easy", description: "", points: 10, enabled: 1 });
            map1 = MapsService.upsert(db, { filename: "map1", stage: "", tierId: tier.id, enabled: 1 });
            map2 = MapsService.upsert(db, { filename: "map2", stage: "", tierId: tier.id, enabled: 1 });
            map3 = MapsService.upsert(db, { filename: "map3", stage: "", tierId: tier.id, enabled: 1 });
            player1 = PlayersService.upsert(db, { steamId: "STEAM_0:1:100", name: "Explorer" });
            player2 = PlayersService.upsert(db, { steamId: "STEAM_0:1:200", name: "Grinder" });
            player3 = PlayersService.upsert(db, { steamId: "STEAM_0:1:300", name: "Casual" });
        });

        const createRun = async (mapId, playerId) => {
            const res = await client.post("/runs")
                .send({
                    playerId,
                    sessionId: `session-${Date.now()}-${Math.random()}`,
                    mapId,
                    kills: 0,
                    deaths: 0,
                    presencePercentage: 100,
                    extractionTime: 120,
                    mutators: [],
                    tags: [],
                    weaponKills: [],
                });

            expect(res.status).toBe(201);
            return res.body.runId;
        };

        test("windows extraction-count leaderboard around a player", async () => {
            await createRun(map1.id, player1.id);
            await createRun(map2.id, player1.id);
            await createRun(map3.id, player1.id); // 3 extractions

            await createRun(map1.id, player2.id);
            await createRun(map2.id, player2.id); // 2 extractions

            await createRun(map1.id, player3.id); // 1 extraction

            const res = await client.get("/leaderboards/extractions")
                .query({ playerId: player2.id, context: 1 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);
            expect(res.body.map(r => r.player_id)).toEqual([player1.id, player2.id, player3.id]);
        });

        test("returns 404 when player has no extractions under given filters", async () => {
            await createRun(map1.id, player1.id);

            const res = await client.get("/leaderboards/extractions")
                .query({ playerId: player2.id });

            expect(res.status).toBe(404);
        });
    });
});