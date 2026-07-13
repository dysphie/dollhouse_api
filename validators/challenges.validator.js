import { z } from "zod";

export const weeklyChallengesSchema = z.object({
    params: z.object({
        playerId: z.coerce.number().int().positive()
    })
});