import { z } from "zod";

export const toUnixSeconds = (val, ctx) => {
    const date = val instanceof Date ? val : new Date(val);

    if (isNaN(date.getTime())) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid date",
        });
        return z.NEVER;
    }

    return Math.floor(date.getTime() / 1000);
};

export const csvIntList = z.union([
  // "1,2,3"
  z.string()
    .regex(/^\d+(,\d+)*$/, {
      message: 'Must be a comma-separated list of positive integers (e.g. "1,2,3")',
    })
    .transform((val) => val.split(",").map(Number)),

  // ?mutators=1&mutators=2&mutators=3
  z.array(z.coerce.number().int().positive()),
]);