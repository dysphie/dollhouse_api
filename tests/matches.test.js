import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";

import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { TiersService } from "../services/tiers.service.js";
import { MapsService } from "../services/maps.service.js";
import { PlayersService } from "../services/players.service.js";
import { MutatorsService } from "../services/mutators.service.js";
import { api } from "./helpers/api-client.js";

describe("Matches API", () => {
    let db;
    let app;
    let client;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);
    });

    describe("GET /matches", () => {
        let tierEasy, tierHard, mapA, mapB, mapC;
        let playerX, playerY, playerZ;
        let mutHardcore, mutPermadeath, mutFriendlyFire;
        let sessionCounter;

        beforeEach(() => {
            tierEasy = TiersService.upsert(db, { name: "Easy", description: "", points: 10, enabled: 1 });
            tierHard = TiersService.upsert(db, { name: "Hard", description: "", points: 50, enabled: 1 });

            mapA = MapsService.upsert(db, { filename: "map_a", stage: "", tierId: tierEasy.id, enabled: 1 });
            mapB = MapsService.upsert(db, { filename: "map_b", stage: "", tierId: tierEasy.id, enabled: 1 });
            mapC = MapsService.upsert(db, { filename: "map_c", stage: "", tierId: tierHard.id, enabled: 1 });

            playerX = PlayersService.upsert(db, { steamId: "STEAM_0:1:100", name: "PlayerX" });
            playerY = PlayersService.upsert(db, { steamId: "STEAM_0:1:200", name: "PlayerY" });
            playerZ = PlayersService.upsert(db, { steamId: "STEAM_0:1:300", name: "PlayerZ" });

            mutHardcore = MutatorsService.upsert(db, { name: "hardcore", description: "", enabled: 1 });
            mutPermadeath = MutatorsService.upsert(db, { name: "permadeath", description: "", enabled: 1 });
            mutFriendlyFire = MutatorsService.upsert(db, { name: "friendly_fire", description: "", enabled: 1 });

            sessionCounter = 0;
        });

        const createRun = async (overrides = {}) => {
            sessionCounter += 1;

            const res = await client.post("/runs")
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

        const createMatch = async (sessionId, mapId, players, mutators = []) => {
            const runIds = [];
            for (const player of players) {
                const runId = await createRun({
                    playerId: player.id,
                    sessionId: sessionId,
                    mapId: mapId,
                    mutators: mutators,
                    kills: Math.floor(Math.random() * 50),
                    deaths: Math.floor(Math.random() * 5),
                    presencePercentage: 80 + Math.random() * 20,
                    extractionTime: 60 + Math.random() * 120
                });
                runIds.push(runId);
            }
            return runIds;
        };

        test("returns empty array when no matches exist", async () => {
            const response = await client.get("/matches");
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        test("returns matches grouped by session", async () => {
            const sessionId = "match-001";
            await createMatch(sessionId, mapA.id, [playerX, playerY]);

            const response = await client.get("/matches");
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            
            const match = response.body[0];
            expect(match.session_id).toBe(sessionId);
            expect(match.map_id).toBe(mapA.id);
            expect(match.map_name).toBe("map_a");
            expect(match.runs).toHaveLength(2);
            
            const runIds = match.runs.map(r => r.player_id).sort();
            expect(runIds).toEqual([playerX.id, playerY.id].sort());
        });

        test("returns multiple matches in descending order", async () => {
            await createMatch("match-001", mapA.id, [playerX]);
            await createMatch("match-002", mapB.id, [playerX]);
            await createMatch("match-003", mapC.id, [playerX]);

            const response = await client.get("/matches");
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(3);
            
            // Should be sorted by created_at DESC (newest first)
            const sessionIds = response.body.map(m => m.session_id);
            expect(sessionIds).toEqual(["match-003", "match-002", "match-001"]);
        });

        test("filters by mapId", async () => {
            await createMatch("match-001", mapA.id, [playerX]);
            await createMatch("match-002", mapB.id, [playerX]);
            await createMatch("match-003", mapA.id, [playerY]);

            const response = await client.get("/matches").query({ mapId: mapA.id });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            
            const sessionIds = response.body.map(m => m.session_id).sort();
            expect(sessionIds).toEqual(["match-001", "match-003"]);
            
            // all matches should have mapA
            for (const match of response.body) {
                expect(match.map_id).toBe(mapA.id);
            }
        });

        test("filters by player", async () => {
            await createMatch("match-001", mapA.id, [playerX, playerY]);
            await createMatch("match-002", mapA.id, [playerX, playerZ]);
            await createMatch("match-003", mapA.id, [playerY, playerZ]);

            const response = await client.get("/matches").query({ player: playerX.id });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            
            const sessionIds = response.body.map(m => m.session_id).sort();
            expect(sessionIds).toEqual(["match-001", "match-002"]);
            
            // all matches should contain playerX
            for (const match of response.body) {
                const playerIds = match.runs.map(r => r.player_id);
                expect(playerIds).toContain(playerX.id);
            }
        });

        test("filters by mutators (exact match)", async () => {
            await createMatch("match-001", mapA.id, [playerX], [mutHardcore.id]);
            await createMatch("match-002", mapA.id, [playerX], [mutHardcore.id, mutPermadeath.id]);
            await createMatch("match-003", mapA.id, [playerX], [mutFriendlyFire.id]);
            await createMatch("match-004", mapA.id, [playerX], [mutHardcore.id, mutPermadeath.id, mutFriendlyFire.id]);

            const response = await client.get("/matches")
                .query({ mutators: [mutHardcore.id, mutPermadeath.id].join(",") });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            
            const match = response.body[0];
            expect(match.session_id).toBe("match-002");
            expect(match.mutator_ids.sort()).toEqual([mutHardcore.id, mutPermadeath.id].sort());
        });

        test("filters by mutators with AND semantics", async () => {
            await createMatch("match-001", mapA.id, [playerX], [mutHardcore.id]);
            await createMatch("match-002", mapA.id, [playerX], [mutHardcore.id, mutPermadeath.id]);
            await createMatch("match-003", mapA.id, [playerX], [mutHardcore.id, mutPermadeath.id, mutFriendlyFire.id]);

            const response = await client.get("/matches")
                .query({ mutators: [mutHardcore.id, mutPermadeath.id] });
            
            expect(response.status).toBe(200);
            // only match-002 has exactly the specified mutators
            expect(response.body).toHaveLength(1);
            expect(response.body[0].session_id).toBe("match-002");
        });

        test("filters by multiple criteria combined", async () => {
            await createMatch("match-001", mapA.id, [playerX], [mutHardcore.id]);
            await createMatch("match-002", mapA.id, [playerX], [mutHardcore.id, mutPermadeath.id]);
            await createMatch("match-003", mapB.id, [playerX], [mutHardcore.id, mutPermadeath.id]);
            await createMatch("match-004", mapA.id, [playerY], [mutHardcore.id, mutPermadeath.id]);

            const response = await client.get("/matches")
                .query({
                    mapId: mapA.id,
                    player: playerX.id,
                    mutators: [mutHardcore.id, mutPermadeath.id]
                });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            
            const match = response.body[0];
            expect(match.session_id).toBe("match-002");
            expect(match.map_id).toBe(mapA.id);
            expect(match.runs.some(r => r.player_id === playerX.id)).toBe(true);
            expect(match.mutator_ids.sort()).toEqual([mutHardcore.id, mutPermadeath.id].sort());
        });

        test("respects limit and offset for pagination", async () => {
            await createMatch("match-001", mapA.id, [playerX]);
            await createMatch("match-002", mapA.id, [playerX]);
            await createMatch("match-003", mapA.id, [playerX]);
            await createMatch("match-004", mapA.id, [playerX]);
            await createMatch("match-005", mapA.id, [playerX]);

            const response = await client.get("/matches")
                .query({ limit: 2, offset: 1 });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            
            const sessionIds = response.body.map(m => m.session_id);
            expect(sessionIds).toEqual(["match-004", "match-003"]);
        });

        test("handles matches with multiple players", async () => {
            const sessionId = "multi-player-match";
            await createMatch(sessionId, mapA.id, [playerX, playerY, playerZ]);

            const response = await client.get("/matches");
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            
            const match = response.body[0];
            expect(match.runs).toHaveLength(3);
            
            const playerIds = match.runs.map(r => r.player_id).sort();
            expect(playerIds).toEqual([playerX.id, playerY.id, playerZ.id].sort());
            
            // each run should have player details
            for (const run of match.runs) {
                expect(run).toHaveProperty("player_id");
                expect(run).toHaveProperty("player_name");
                expect(run).toHaveProperty("steam_id");
                expect(run).toHaveProperty("kills");
                expect(run).toHaveProperty("deaths");
                expect(run).toHaveProperty("extraction_time");
                expect(run).toHaveProperty("tag_ids");
                expect(Array.isArray(run.tag_ids)).toBe(true);
            }
        });

        test("handles matches with mutators on all runs", async () => {
            const sessionId = "mutator-match";
            await createMatch(sessionId, mapA.id, [playerX, playerY], [mutHardcore.id, mutPermadeath.id]);

            const response = await client.get("/matches");
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            
            const match = response.body[0];
            expect(match.mutator_ids.sort()).toEqual([mutHardcore.id, mutPermadeath.id].sort());
        });

        test("handles matches with no mutators", async () => {
            const sessionId = "no-mutator-match";
            await createMatch(sessionId, mapA.id, [playerX]);

            const response = await client.get("/matches");
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            
            const match = response.body[0];
            expect(match.mutator_ids).toEqual([]);
        });

        test("returns correct map information", async () => {
            const sessionId = "map-info-match";
            await createMatch(sessionId, mapC.id, [playerX]);

            const response = await client.get("/matches");
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            
            const match = response.body[0];
            expect(match.map_id).toBe(mapC.id);
            expect(match.map_name).toBe("map_c");
            expect(match.map_stage).toBe("");
        });

        test("rejects invalid filter values", async () => {
            const response = await client.get("/matches")
                .query({ mapId: "not-a-number" });
            
            expect(response.status).toBe(400);
        });

        test("rejects negative offset", async () => {
            const response = await client.get("/matches")
                .query({ offset: -1 });
            
            expect(response.status).toBe(400);
        });

        test("rejects negative limit", async () => {
            const response = await client.get("/matches")
                .query({ limit: -5 });
            
            expect(response.status).toBe(400);
        });
    });
});