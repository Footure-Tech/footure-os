import { MdCheckCircle, MdDraw, MdError } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { buscarConfiguracaoComissionamento } from "@/lib/comissao/configuracoes";
import { buscarStatusBling } from "@/lib/integracoes/bling";
import { PageHeader } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ds/status-pill";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";
import { BlocoComissionamento } from "@/components/configuracoes/bloco-comissionamento";
import { BlocoBling } from "@/components/configuracoes/bloco-bling";
import { cn } from "@/lib/utils";

const MENSAGEM_BLING: Record<string, { titulo: string; erro: boolean }> = {
  conectado: { titulo: "Bling conectado com sucesso.", erro: false },
  erro: { titulo: "Falha ao conectar com o Bling — veja os logs do servidor.", erro: true },
  erro_state: { titulo: "Falha de validação (state) ao conectar com o Bling — tente novamente.", erro: true },
};

export default async function ConfiguracoesPage({ searchParams }: PageProps<"/admin/configuracoes">) {
  const { bling } = await searchParams;
  const supabase = await createClient();
  const [comissionamento, statusBling] = await Promise.all([
    buscarConfiguracaoComissionamento(supabase),
    buscarStatusBling(supabase),
  ]);

  const mensagemBling = typeof bling === "string" ? MENSAGEM_BLING[bling] : undefined;
  // Clicksign é configurada por variáveis de ambiente (sem OAuth) — mesmo critério do card de Integrações da sidebar.
  const clicksignConfigurada = !!process.env.CLICKSIGN_API_URL && !!process.env.CLICKSIGN_ACCESS_TOKEN;
  const ambienteClicksign = process.env.CLICKSIGN_API_URL?.includes("sandbox") ? "Sandbox" : clicksignConfigurada ? "Produção" : null;

  return (
    <div className="flex max-w-[1100px] flex-col gap-6">
      <PageHeader modulo="Administração" titulo="Configurações" descricao="Parâmetros de comissionamento e conexões com os serviços integrados." />

      {mensagemBling && (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl border px-5 py-4 text-sm font-semibold",
            mensagemBling.erro ? "border-red/30 bg-dangerBg text-red" : "border-green1/30 bg-green5 text-green1",
          )}
        >
          {mensagemBling.erro ? <MdError className="size-5 shrink-0" /> : <MdCheckCircle className="size-5 shrink-0" />}
          {mensagemBling.titulo}
        </div>
      )}

      <BlocoComissionamento
        percentualImposto={comissionamento.percentual_imposto}
        percentualComissaoTotal={comissionamento.percentual_comissao_total}
        percentualComissaoSdr={comissionamento.percentual_comissao_sdr}
        percentualComissaoCloser={comissionamento.percentual_comissao_closer}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-start gap-5">
        <BlocoBling conectado={statusBling.conectado} expiresAt={statusBling.expiresAt} atualizadoEm={statusBling.atualizadoEm} />

        <CardModulo
          icone={MdDraw}
          cor="bg-iconPurple"
          titulo="Clicksign"
          extra={<StatusPill tom={clicksignConfigurada ? "active" : "not_started"}>{clicksignConfigurada ? "Configurada" : "Não configurada"}</StatusPill>}
        >
          <p className="-mt-1 text-sm text-gray">Assinatura eletrônica dos contratos — envelope com os signatários e acompanhamento por webhook.</p>
          <div className="flex flex-col">
            <LinhaChaveValor rotulo="Ambiente" valor={ambienteClicksign} />
            <LinhaChaveValor rotulo="Webhook" valor={process.env.CLICKSIGN_WEBHOOK_SECRET ? "Segredo HMAC configurado" : "Segredo HMAC ausente"} />
          </div>
          <p className="text-xs text-gray3">A conexão é definida pelas variáveis de ambiente do servidor (CLICKSIGN_API_URL, CLICKSIGN_ACCESS_TOKEN e CLICKSIGN_WEBHOOK_SECRET).</p>
        </CardModulo>
      </div>
    </div>
  );
}
