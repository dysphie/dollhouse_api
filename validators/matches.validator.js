import { z } from "zod";
import { csvIntList } from "./common.validator.js";

export const matchesFiltersSchema = z.object({
    query: z.object({
        mapId: z.coerce.number().int().positive().optional(),
        mutators: csvIntList.optional(),
        player: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().default(20),
        offset: z.coerce.number().int().min(0).default(0)
    })
});