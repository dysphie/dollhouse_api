import { z } from "zod";

export const awardPointsSchema = z.object({
    params: z.object({
        playerId: z.coerce.number().int().positive()
    }),
    body: z.object({
        points: z.coerce.number().int(),
        transaction_type: z.enum([
            "run_completion",
            "bonus",
            "penalty",
            "admin_adjustment"
        ]),
        reason: z.string().trim().min(1),
        run_id: z.coerce.number().int().positive().optional()
    })
});

export const getPointsHistorySchema = z.object({
  params: z.object({
    playerId: z.coerce.number().int().positive(),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});