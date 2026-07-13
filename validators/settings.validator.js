import { z } from "zod";

export const getSettingsSchema = z.object({
    params: z.object({
        playerId: z.coerce.number().int().positive()
    })
});

export const updateSettingsSchema = z.object({
    params: z.object({
        playerId: z.coerce.number().int().positive()
    }),
    body: z.object({
        raw_maps: z.boolean().optional(),
        show_self_keys: z.boolean().optional(),
        show_other_keys: z.boolean().optional(),
        show_ragdolls: z.boolean().optional(),
        show_self_kills: z.boolean().optional(),
        show_other_kills: z.boolean().optional(),
        hide_tips: z.boolean().optional(),
        render_distance: z.number().int().optional(),
        hide_distance: z.number().int().optional(),
        mutator_ids: z.array(z.coerce.number().int().positive()).optional(),
        tag_ids: z.array(z.coerce.number().int().positive()).optional()
    }).refine(
        value => Object.keys(value).length > 0,
        {
            message: "At least one setting must be specified."
        }
    )
});