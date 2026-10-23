import { exigirPapel } from "@/lib/auth/session";
import { PAPEIS_COBRANCA } from "@/lib/cobranca/permissoes";
import { createClient } from "@/lib/supabase/server";
import { carregarTelaCobranca, type AbaCobranca } from "@/lib/cobranca/consultas";
import { TelaCobranca, type StatusInter } from "@/components/cobranca/tela-cobranca";
import { pendenciasEmissaoInter } from "@/lib/cobranca/boletos";
import { consultarWebhookInter, interConfigurado } from "@/lib/integracoes/inter";

const ABAS: AbaCobranca[] = ["aprovacao", "historico", "clientes", "configuracao"];

// Aprovar envia os e-mails e confere cada parcela no Bling — pode levar mais que o padrão.
export const maxDuration = 300;

// Financeiro · Régua de cobrança (0058). Diretoria e Financeiro (o layout do Financeiro também libera o comercial).
export default async function CobrancaPage({ searchParams }: PageProps<"/financeiro/cobranca">) {
  await exigirPapel(...PAPEIS_COBRANCA);
  const { aba: a } = await searchParams;
  const aba = ABAS.includes(a as AbaCobranca) ? (a as AbaCobranca) : "aprovacao";
  const dados = await carregarTelaCobranca(await createClient());
  // F2 (Banco Inter): o que falta para ligar a emissão e o webhook registrado — só na aba Configuração.
  let statusInter: StatusInter | undefined;
  if (aba === "configuracao") {
    let webhook: string | null = null;
    let erroWebhook: string | null = null;
    if (interConfigurado()) {
      try {
        webhook = (await consultarWebhookInter())?.webhookUrl.replace(/chave=[^&]+/, "chave=•••") ?? null;
      } catch (e) {
        erroWebhook = e instanceof Error ? e.message.slice(0, 200) : String(e);
      }
    }
    statusInter = { configurado: interConfigurado(), pendencias: pendenciasEmissaoInter(dados.config), webhook, erroWebhook, segredoWebhook: !!process.env.INTER_WEBHOOK_SEGREDO };
  }
  return <TelaCobranca dados={dados} aba={aba} statusInter={statusInter} />;
}
