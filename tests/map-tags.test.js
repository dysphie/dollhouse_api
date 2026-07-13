import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { MapTagsService } from "../services/map-tags.service.js";
import { api } from "./helpers/api-client.js";

describe("Map Tags API", () => {
    let db;
    let app;
    let client;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        MapTagsService.upsert(db, { name: "linear", description: "", enabled: 1 });
        MapTagsService.upsert(db, { name: "surf", description: "", enabled: 1 });
        MapTagsService.upsert(db, { name: "staged", description: "", enabled: 1 });
    });

    test("lists all enabled map tags", async () => {
        const res = await client.get("/map-tags");

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
    });

    test("excludes disabled map tags", async () => {
        MapTagsService.upsert(db, { name: "linear", description: "", enabled: 0 });

        const res = await client.get("/map-tags");

        expect(res.status).toBe(200);
        expect(res.body.map((t) => t.name)).not.toContain("linear");
        expect(res.body).toHaveLength(2);
    });

    test("returns an empty array when no map tags exist", async () => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        const res = await client.get("/map-tags");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test("each map tag includes id, name, description, and enabled", async () => {
        const res = await client.get("/map-tags");

        expect(res.status).toBe(200);
        expect(res.body[0]).toMatchObject({
            id: expect.any(Number),
            name: expect.any(String),
            description: expect.any(String),
            enabled: 1
        });
    });
});