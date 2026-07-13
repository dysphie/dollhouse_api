import { describe, test, beforeEach, expect } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import { DatabaseService } from "../services/database.service.js";
import { MutatorsService } from "../services/mutators.service.js";
import { api } from "./helpers/api-client.js";

describe("Mutators API", () => {
    let db;
    let app;
    let client;
    let mutHardcore, mutPermadeath, mutFriendlyFire;

    beforeEach(() => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        mutHardcore = MutatorsService.upsert(db, { name: "hardcore", description: "", enabled: 1 });
        mutPermadeath = MutatorsService.upsert(db, { name: "permadeath", description: "", enabled: 1 });
        mutFriendlyFire = MutatorsService.upsert(db, { name: "friendly_fire", description: "", enabled: 1 });
    });

    test("lists all enabled mutators", async () => {
        const res = await client.get("/mutators");
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
    });

    test("excludes disabled mutators", async () => {
        MutatorsService.upsert(db, { name: "hardcore", description: "", enabled: 0 });

        const res = await client.get("/mutators");

        expect(res.status).toBe(200);
        expect(res.body.map((m) => m.name)).not.toContain("hardcore");
        expect(res.body).toHaveLength(2);
    });

    test("returns an empty array when no mutators exist", async () => {
        db = new Database(":memory:");
        DatabaseService.initialize(db);
        app = createApp({ db });
        client = api(app);

        const res = await client.get("/mutators");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test("each mutator includes id, name, description, and enabled", async () => {
        const res = await client.get("/mutators");

        expect(res.status).toBe(200);
        expect(res.body[0]).toMatchObject({
            id: expect.any(Number),
            name: expect.any(String),
            description: expect.any(String),
            enabled: 1
        });
    });
});