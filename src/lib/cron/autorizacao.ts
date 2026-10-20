import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Crons da Vercel (vercel.json): o CRON_SECRET chega no header Authorization. */
export function cronAutorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
