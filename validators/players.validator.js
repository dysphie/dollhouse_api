import { z } from "zod";

export const playerSearchSchema = z.object({
    query: z.object({
        q: z.string().min(1)
    })
});