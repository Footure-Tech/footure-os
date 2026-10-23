import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth/session";

const AREA_POR_PAPEL = {
  vendedor: "/vendedor",
  juridico: "/juridico",
  admin: "/dashboard",
  marketing: "/marketing",
  financeiro: "/financeiro/cobranca",
} as const;

export default async function Home() {
  const sessao = await obterSessao();
  redirect(sessao ? AREA_POR_PAPEL[sessao.papel] : "/login");
}
