import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(20),
  optionIds: z.array(z.string()).max(12).optional().default([]),
  note: z.string().max(140).optional().default(""),
});

export const customerSchema = z.object({
  name: z.string().min(3).max(80),
  phone: z.string().min(10).max(20).refine(v => v.replace(/\D/g,"").length >= 10, "WhatsApp inválido"),
  addr: z.string().max(200).optional().default(""),
});

export const createOrderSchema = z.object({
  customer: customerSchema,
  items: z.array(orderItemSchema).min(1).max(60),
  type: z.enum(["delivery", "pickup", "dine_in", "mesa"]).default("delivery"),
  payment: z.enum(["PIX", "CARTAO_ONLINE", "Cartão", "Dinheiro", "No fechamento da mesa", "Mesa", "Balcão", "PIX (teste)"]).or(z.string().min(3)),
  couponCode: z.string().optional(),
  note: z.string().max(200).optional().default(""),
  tableNumber: z.number().int().min(1).max(50).optional().nullable(),
  tableName: z.string().max(30).optional().nullable(),
  channel: z.enum(["DIRECT", "IFOOD", "NNFOOD", "WHATSAPP"]).optional(),
  changeFor: z.string().max(20).optional(),
});

export function validateOrder(body) {
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(msg);
  }
  return parsed.data;
}
