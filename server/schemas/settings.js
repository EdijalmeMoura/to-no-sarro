import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "use o formato HH:MM").refine((v) => {
  const [h, m] = v.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}, "horário inválido (00:00 – 23:59)");

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  open: hhmm,
  close: hhmm,
});

// Segunda a domingo, cada dia com abertura/fechamento e ativação
export const weekScheduleSchema = z.object({
  seg: dayScheduleSchema,
  ter: dayScheduleSchema,
  qua: dayScheduleSchema,
  qui: dayScheduleSchema,
  sex: dayScheduleSchema,
  sab: dayScheduleSchema,
  dom: dayScheduleSchema,
});

export const settingsSchema = z.object({
  store_name: z.string().min(3).max(80).optional(),
  whatsapp: z.string().max(30).optional(),
  address: z.string().max(160).optional(),
  hours: z.string().max(80).optional(),
  fee: z.number().min(0).max(100).optional(),
  min_order: z.number().min(0).max(1000).optional(),
  eta: z.string().max(40).optional(),
  pix_key: z.string().max(100).optional(),
  pay_handle: z.string().max(30).optional(),
  app_base_url: z.string().url().optional().or(z.literal("")),
  tables_enabled: z.boolean().optional(),
  tables_count: z.number().int().min(1).max(50).optional(),
  service_charge_enabled: z.boolean().optional(),
  service_charge_percent: z.number().min(0).max(30).optional(),
  open: z.boolean().optional(),
  week_schedule: weekScheduleSchema.optional(),
}).passthrough();

export function validateSettings(body) {
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(msg);
  }
  return parsed.data;
}
