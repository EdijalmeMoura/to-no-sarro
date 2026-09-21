import { z } from "zod";

export const couponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  type: z.enum(["percent", "fixed", "freeship"]),
  value: z.number().min(0).max(1000),
  min: z.number().min(0).max(10000).optional().default(0),
  max_uses: z.number().int().min(1).max(100000).optional().default(100),
  active: z.boolean().optional().default(true),
  note: z.string().max(200).optional().default(""),
});

export function validateCoupon(body) {
  const parsed = couponSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(msg);
  }
  return parsed.data;
}
