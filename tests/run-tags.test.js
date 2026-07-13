import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { PerfTagsService } from "../services/run-tags.service.js";
import { api } from "./helpers/api-client.js";

describe("Perf Tags API", () => {
    let db;
    let app;
    let client;
    let tagSpeedrun, tagPacifist, tagNoDamage;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        tagSpeedrun = PerfTagsService.upsert(db, { mapId: null, name: "speedrun", description: "", enabled: 1 });
        tagPacifist = PerfTagsService.upsert(db, { mapId: null, name: "pacifist", description: "", enabled: 1 });
        tagNoDamage = PerfTagsService.upsert(db, { mapId: null, name: "no_damage", description: "", enabled: 1 });
    });

    test("lists all enabled perf tags", async () => {
        const res = await client.get("/run-tags");
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
    });

    test("excludes disabled perf tags", async () => {
        PerfTagsService.upsert(db, { mapId: null, name: "speedrun", description: "", enabled: 0 });

        const res = await client.get("/run-tags");

        expect(res.status).toBe(200);
        expect(res.body.map((t) => t.name)).not.toContain("speedrun");
        expect(res.body).toHaveLength(2);
    });

    test("returns an empty array when no perf tags exist", async () => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        const res = await client.get("/run-tags");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test("each perf tag includes id, map_id, name, description, and enabled", async () => {
        const res = await client.get("/run-tags");

        expect(res.status).toBe(200);
        expect(res.body[0]).toMatchObject({
            id: expect.any(Number),
            map_id: expect.toSatisfy(value => value === null || typeof value === "number"),
            name: expect.any(String),
            description: expect.any(String),
            enabled: 1,
        });
    });
});