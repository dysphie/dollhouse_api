import { z } from "zod";
import { csvIntList, toUnixSeconds } from "./common.validator.js";

export const runIdSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive(),
    }),
});

export const runFiltersSchema = z.object({
    query: z.object({
        playerId: z.coerce.number().int().positive().optional(),
        mapId: z.coerce.number().int().positive().optional(),
        tierId: z.coerce.number().int().positive().optional(),

        minKills: z.coerce.number().int().min(0).optional(),
        maxDeaths: z.coerce.number().int().min(0).optional(),
        minPresence: z.coerce.number().min(0).max(100).optional(),

        after: z.string().transform(toUnixSeconds).optional(),

        before: z.string()
            .transform((val, ctx) => {
                const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(val);
                const seconds = toUnixSeconds(val, ctx);

                if (seconds === z.NEVER) return seconds;

                return dateOnly ? seconds + 86399 : seconds;
            })
            .optional(),

        mutators: csvIntList.optional(),
        tags: csvIntList.optional(),

        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
    }),
});

export const createRunSchema = z.object({
    body: z.object({
        playerId: z.number().int().positive(),
        sessionId: z.string().min(1),
        mapId: z.number().int().positive(),

        damageTaken: z.number().int().min(0).default(0),
        zombieDamageTaken: z.number().int().min(0).default(0),
        zombieDamageDealt: z.number().int().min(0).default(0),
        kills: z.number().int().min(0).default(0),
        deaths: z.number().int().min(0).default(0),
        presencePercentage: z.number().min(0).max(100).default(0),

        extractionTime: z.number().min(0).nullable().optional(),
        replayId: z.string().nullable().optional(),
        pointsAwarded: z.number().int().min(0).default(0),

        mutators: csvIntList.optional(),
        tags: csvIntList.optional(),

        weaponKills: z.array(
            z.object({
                weaponId: z.number().int().positive(),
                kills: z.number().int().min(0),
            })
        ).default([]),
    }),
});