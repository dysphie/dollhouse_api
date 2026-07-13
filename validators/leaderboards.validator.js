import { z } from "zod";
import { csvIntList } from "./common.validator.js";

export const leaderboardFiltersSchema = z.object({
    params: z.object({
        mapId: z.coerce.number().int().positive().optional()
    }),

    query: z.object({
        mutators: csvIntList.optional(),
        tags: csvIntList.optional(),
        limit: z.coerce.number().int().positive().max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        playerId: z.coerce.number().int().positive().optional(),
        context: z.coerce.number().int().positive().max(50).default(5),
    })
})