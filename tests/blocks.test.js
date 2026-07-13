import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { PlayersService } from "../services/players.service.js";
import { CommunicationBlocksService } from "../services/blocks.service.js";
import { api } from "./helpers/api-client.js";

describe("Communication Blocks API", () => {
    let db;
    let app;
    let client;
    let playerId;
    let targetPlayerId;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        playerId = PlayersService.upsert(db, {
            steamId: "STEAM_0:1:123",
            name: "Player"
        }).id;

        targetPlayerId = PlayersService.upsert(db, {
            steamId: "STEAM_0:1:456",
            name: "Target"
        }).id;
    });

    test("creates a single communication block", async () => {
        const res = await client.put(`/players/${playerId}/blocks/${targetPlayerId}`)
            .send({ chat: true });

        expect(res.status).toBe(204);

        expect(
            CommunicationBlocksService.get(db, playerId)
        ).toEqual([
            expect.objectContaining({
                target_player_id: targetPlayerId,
                kind: "chat"
            })
        ]);
    });

    test("creates multiple communication blocks", async () => {
        await client.put(`/players/${playerId}/blocks/${targetPlayerId}`)
            .send({
                chat: true,
                voice: true,
                voicecmd: true
            });

        const blocks = CommunicationBlocksService
            .get(db, playerId)
            .map(b => b.kind)
            .sort();

        expect(blocks).toEqual([
            "chat",
            "voice",
            "voicecmd"
        ]);
    });

    test("removes an existing communication block", async () => {
        CommunicationBlocksService.update(
            db,
            playerId,
            targetPlayerId,
            { chat: true }
        );

        const res = await client.put(`/players/${playerId}/blocks/${targetPlayerId}`)
            .send({ chat: false });

        expect(res.status).toBe(204);

        expect(
            CommunicationBlocksService.get(db, playerId)
        ).toEqual([]);
    });

    test("can insert and remove in the same request", async () => {
        CommunicationBlocksService.update(
            db,
            playerId,
            targetPlayerId,
            {
                chat: true,
                voice: true
            }
        );

        await client.put(`/players/${playerId}/blocks/${targetPlayerId}`)
            .send({
                chat: false,
                voice: true,
                voicecmd: true
            });

        const blocks = CommunicationBlocksService
            .get(db, playerId)
            .map(b => b.kind)
            .sort();

        expect(blocks).toEqual([
            "voice",
            "voicecmd"
        ]);
    });

    test("is idempotent", async () => {
        const body = {
            chat: true,
            voice: true
        };

        await client.put(`/players/${playerId}/blocks/${targetPlayerId}`).send(body);
        await client.put(`/players/${playerId}/blocks/${targetPlayerId}`).send(body);

        const blocks = CommunicationBlocksService
            .get(db, playerId)
            .map(b => b.kind)
            .sort();

        expect(blocks).toEqual([
            "chat",
            "voice"
        ]);
    });

    test("gets all communication blocks for a player", async () => {
        const otherTargetId = PlayersService.upsert(db, {
            steamId: "STEAM_0:1:789",
            name: "Other Target"
        }).id;

        CommunicationBlocksService.update(
            db,
            playerId,
            targetPlayerId,
            {
                chat: true,
                voice: true
            }
        );

        CommunicationBlocksService.update(
            db,
            playerId,
            otherTargetId,
            {
                voicecmd: true
            }
        );

        const res = await client.get(`/players/${playerId}/blocks`);

        expect(res.status).toBe(200);

        expect(res.body).toEqual(expect.arrayContaining([
            expect.objectContaining({
                target_player_id: targetPlayerId,
                kind: "chat"
            }),
            expect.objectContaining({
                target_player_id: targetPlayerId,
                kind: "voice"
            }),
            expect.objectContaining({
                target_player_id: otherTargetId,
                kind: "voicecmd"
            })
        ]));
    });

    test("returns an empty array when a player has no communication blocks", async () => {
        const res = await client.get(`/players/${playerId}/blocks`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test("returns 400 for an empty body", async () => {
        const res = await client.put(`/players/${playerId}/blocks/${targetPlayerId}`)
            .send({});

        expect(res.status).toBe(400);
    });

    test("returns 400 for an invalid block kind", async () => {
        const res = await client.put(`/players/${playerId}/blocks/${targetPlayerId}`)
            .send({
                video: true
            });

        expect(res.status).toBe(400);
    });

    test("returns 404 when targetPlayerId is missing", async () => {
        const res = await client.put(`/players/${playerId}/blocks`)
            .send({
                chat: true
            });

        expect(res.status).toBe(404);
    });
});