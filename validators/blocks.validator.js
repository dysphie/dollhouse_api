import { z } from "zod";

export const updateCommunicationBlocksSchema = z.object({
    params: z.object({
        playerId: z.coerce.number().int().positive(),
        targetPlayerId: z.coerce.number().int().positive()
    }),
    body: z.object({
        chat: z.boolean().optional(),
        voice: z.boolean().optional(),
        voicecmd: z.boolean().optional()
    }).refine(
        value =>
            value.chat !== undefined ||
            value.voice !== undefined ||
            value.voicecmd !== undefined,
        {
            message: "At least one block type must be specified."
        }
    )
});

export const getCommunicationBlocksSchema = z.object({
    params: z.object({
        playerId: z.coerce.number().int().positive()
    })
});