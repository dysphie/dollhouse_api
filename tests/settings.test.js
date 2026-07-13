import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { PlayersService } from "../services/players.service.js";
import { MutatorsService } from "../services/mutators.service.js";
import { SettingsService } from "../services/settings.service.js";
import { PerfTagsService } from "../services/run-tags.service.js";
import { api } from "./helpers/api-client.js";

describe("Settings API", () => {
    let db;
    let app;
    let client;
    let playerId;
    let mutatorId;
    let otherMutatorId;
    let tagId;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        playerId = PlayersService.upsert(db, {
            steamId: "STEAM_0:1:123",
            name: "Player"
        }).id;

        mutatorId = MutatorsService.upsert(db, { name: "instagib", description: "", enabled: 1 }).id;
        otherMutatorId = MutatorsService.upsert(db, { name: "headshot_only", description: "", enabled: 1 }).id;
        tagId = PerfTagsService.upsert(db, { name: "speedrun", description: "", enabled: 1 }).id;
    });

    test("returns settings for the player", async () => {
        const res = await client.get(`/players/${playerId}/settings`);
        expect(res.status).toBe(200);
    });

    test("creates settings on first update and returns defaults for unset fields", async () => {
        const res = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ raw_maps: true });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            raw_maps: 1,
            show_self_keys: 0,
            show_other_keys: 0,
            show_ragdolls: 0,
            show_self_kills: 0,
            show_other_kills: 0,
            hide_tips: 0,
            render_distance: -1,
            hide_distance: -1,
            mutator_ids: [],
            tag_ids: []
        });
    });

    test("updates an arbitrary number of boolean and integer keys in one request", async () => {
        const res = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send( {
                show_ragdolls: true,
                show_self_kills: true,
                hide_tips: true,
                render_distance: 4000,
                hide_distance: 1500   
            });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            show_ragdolls: 1,
            show_self_kills: 1,
            hide_tips: 1,
            render_distance: 4000,
            hide_distance: 1500
        });
    });

    test("partial updates do not reset previously set fields", async () => {
        await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ raw_maps: true, render_distance: 8000 });

        const res = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ hide_tips: true });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            raw_maps: 1,
            render_distance: 8000,
            hide_tips: 1
        });
    });

    test("sets mutator and tag filters", async () => {
        const res = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({
                    mutator_ids: [mutatorId, otherMutatorId],
                    tag_ids: [tagId]
            });

        expect(res.status).toBe(200);
        expect(res.body.mutator_ids.sort()).toEqual([mutatorId, otherMutatorId].sort());
        expect(res.body.tag_ids).toEqual([tagId]);
    });

    test("replaces filters wholesale rather than merging on repeat updates", async () => {
        await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ mutator_ids: [mutatorId, otherMutatorId] });

        const res = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ mutator_ids: [otherMutatorId] });

        expect(res.status).toBe(200);
        expect(res.body.mutator_ids).toEqual([otherMutatorId]);
    });

    test("an empty array clears all filters", async () => {
        await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ mutator_ids: [mutatorId] });

        const res = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ mutator_ids: [] });

        expect(res.status).toBe(200);
        expect(res.body.mutator_ids).toEqual([]);
    });

    test("updating boolean/int fields does not touch existing filters", async () => {
        await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ mutator_ids: [mutatorId], tag_ids: [tagId] });

        const res = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ raw_maps: true });

        expect(res.status).toBe(200);
        expect(res.body.mutator_ids).toEqual([mutatorId]);
        expect(res.body.tag_ids).toEqual([tagId]);
    });

    test("GET reflects the latest updated state", async () => {
        const what = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ show_self_keys: true, hide_distance: 2500 });

        const res = await client.get(`/players/${playerId}/settings`);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            show_self_keys: 1,
            hide_distance: 2500
        });
    });

    test("returns 400 for an empty settings object", async () => {
        const res = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({});

        expect(res.status).toBe(400);
    });

    test("returns 400 when playerId is invalid", async () => {
        const res = await request(app)
            .patch(`/players/-1/settings`)
            .send({ raw_maps: true });

        expect(res.status).toBe(400);
    });

    test("returns 404 when player doesn't exist", async () => {
        const res = await request(app)
            .patch(`/players/999/settings`)
            .send({ raw_maps: true });

        expect(res.status).toBe(404);
    });

    test("returns 400 for a non-boolean value on a boolean field", async () => {
        const res = await request(app)
            .patch(`/players/${playerId}/settings`)
            .send({ raw_maps: "yes" });

        expect(res.status).toBe(400);
    });
});