import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(3).max(80),
  cat: z.string().min(1).max(30),
  emoji: z.string().max(10).optional().default("🍔"),
  description: z.string().max(500).optional().default(""),
  ingredients: z.array(z.string().max(80)).max(20).optional().default([]),
  price: z.number().positive().max(1000),
  promo: z.number().positive().max(1000).nullable().optional(),
  time: z.number().int().min(1).max(120).optional().default(15),
  stock: z.number().int().min(0).max(10000).optional().default(0),
  badges: z.array(z.string()).max(10).optional().default([]),
  groups: z.array(z.string()).max(20).optional().default([]),
  available: z.boolean().optional().default(true),
  builder: z.boolean().optional().default(false),
});

export function validateProduct(body) {
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(msg);
  }
  return parsed.data;
}
