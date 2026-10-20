import { MdCampaign } from "react-icons/md";
import type { carregarStatusMarketing } from "@/lib/marketing/status";
import type { SyncExecucaoRow } from "@/lib/supabase/database.types";
import { tempoDecorrido } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";
import { StatusPill } from "@/components/ds/status-pill";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { SeletorBuFunil, SeletorEstagioEtapa, SincronizarMarketingButton } from "@/components/configuracoes/marketing-acoes";

type Status = Awaited<ReturnType<typeof carregarStatusMarketing>>;

const TOM_STATUS: Record<SyncExecucaoRow["status"], { rotulo: string; tom: "active" | "pending" | "inactive" | "in_progress" }> = {
  ok: { rotulo: "OK", tom: "active" },
  parcial: { rotulo: "Parcial", tom: "pending" },
  erro: { rotulo: "Erro", tom: "inactive" },
  rodando: { rotulo: "Rodando", tom: "in_progress" },
};
const ROTULO_TIPO: Record<SyncExecucaoRow["tipo"], string> = { backfill: "Carga do histórico", incremental: "Diária (cron)", manual: "Manual" };

// Card Marketing (Meta Ads + Kommo) em Configurações: credenciais, sincronização,
// funis do Kommo com a BU de cada um (e o estágio padrão de cada etapa) e os
// campos usados na atribuição.
export function BlocoMarketing({ status }: { status: Status }) {
  const { credenciais, config } = status;
  const pronto = credenciais.meta && credenciais.kommo;
  const nomeConta = new Map(status.contas.map((c) => [c.account_id, c.nome]));
  const etapasDoFunil = new Map<number, Status["etapas"]>();
  for (const e of status.etapas) etapasDoFunil.set(e.pipeline_id, [...(etapasDoFunil.get(e.pipeline_id) ?? []), e]);

  return (
    <CardModulo
      icone={MdCampaign}
      cor="bg-iconBlue"
      titulo="Marketing · Meta Ads e Kommo"
      extra={<StatusPill tom={pronto ? "active" : "not_started"}>{pronto ? "Configurado" : "Credenciais pendentes"}</StatusPill>}
    >
      <p className="-mt-1 text-sm text-gray">
        Gasto e leads da Meta e leads do Kommo (MQL, vendas, receita), sincronizados todo dia às 07:00 e sob demanda. Histórico desde{" "}
        {config ? config.backfill_desde.split("-").reverse().join("/") : "01/01/2026"}.
      </p>

      {!status.instalado ? (
        <EstadoVazio compacto icone={MdCampaign} titulo="Tabelas do Marketing ainda não criadas" descricao="Aplique a migration 0047_marketing_base.sql no Supabase." />
      ) : (
        <>
          <div className="grid gap-x-8 md:grid-cols-2">
            <div className="flex flex-col">
              <LinhaChaveValor rotulo="Meta (META_ACCESS_TOKEN)" valor={credenciais.meta ? "Configurado" : "Ausente"} />
              <LinhaChaveValor rotulo="Kommo (KOMMO_SUBDOMAIN/TOKEN)" valor={credenciais.kommo ? "Configurado" : "Ausente"} />
              <LinhaChaveValor rotulo="Cron (CRON_SECRET)" valor={credenciais.cron ? "Configurado" : "Ausente"} />
            </div>
            <div className="flex flex-col">
              <LinhaChaveValor rotulo="Contas da Meta" valor={status.contas.map((c) => `${c.nome}${c.ativa ? "" : " (inativa)"}`).join(" · ")} />
              <LinhaChaveValor rotulo="Leads do Kommo" valor={status.totalLeads.toLocaleString("pt-BR")} />
              <LinhaChaveValor
                rotulo="Campos do Kommo"
                valor={
                  config
                    ? `ad ${config.kommo_campos.utm_ad_id} · content ${config.kommo_campos.utm_content} · campanha ${config.kommo_campos.utm_campaign_id} · valor ${config.kommo_campos.valor_total} · 1º toque ${config.kommo_campos.ftp_utm_campaign ?? "a descobrir"}`
                    : null
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-darkPurple1">Últimas sincronizações</h3>
            <SincronizarMarketingButton desabilitado={!pronto} />
          </div>
          {status.execucoes.length === 0 ? (
            <EstadoVazio compacto icone={MdCampaign} titulo="Nenhuma sincronização ainda" descricao="A primeira carrega o histórico em fatias; se não terminar, continua na próxima." />
          ) : (
            <Table minWidth={720}>
              <TableHeader>
                <TableRow>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Linhas</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.execucoes.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-semibold text-darkPurple1">{e.fonte === "kommo" ? (e.conta === "movimentos" ? "Kommo · Etapas" : e.conta === "mensagens" ? "Kommo · Conversas" : "Kommo") : `Meta · ${nomeConta.get(e.conta ?? "") ?? e.conta}`}</TableCell>
                    <TableCell className="text-gray2">{ROTULO_TIPO[e.tipo]}</TableCell>
                    <TableCell className="max-w-[320px] whitespace-normal">
                      <div className="flex flex-col items-start gap-1">
                        <StatusPill tom={TOM_STATUS[e.status].tom}>{TOM_STATUS[e.status].rotulo}</StatusPill>
                        {e.erro && <span className="text-xs text-red">{e.erro}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray2">{e.linhas_gravadas.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-gray2">{tempoDecorrido(e.iniciado_em)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <h3 className="text-sm font-bold text-darkPurple1">Funis do Kommo e BU</h3>
          <p className="-mt-2 text-xs text-gray3">
            Abra um funil para ver o estágio padrão de cada etapa (visão Funil da campanha). O estágio é sugerido pelo nome da etapa; o que for mudado à mão a sincronização não sobrescreve.
          </p>
          {status.funis.length === 0 ? (
            <p className="text-sm text-gray3">Os funis aparecem depois da primeira sincronização.</p>
          ) : (
            <ul className="flex flex-col">
              {status.funis.map((f) => (
                <li key={f.pipeline_id} className="border-b border-gray5 py-2 last:border-0">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-darkPurple1">
                        <span className="mr-1 inline-block text-gray3 transition-transform group-open:rotate-90">›</span>
                        {f.nome}
                        {f.bu_manual && <span className="ml-2 text-xs text-gray3">(definido à mão)</span>}
                        {(etapasDoFunil.get(f.pipeline_id) ?? []).some((e) => !e.estagio) && <span className="ml-2 text-xs text-orange">etapa sem estágio</span>}
                      </span>
                      <SeletorBuFunil pipelineId={f.pipeline_id} bu={f.bu} />
                    </summary>
                    <ul className="mt-2 ml-4 flex flex-col">
                      {(etapasDoFunil.get(f.pipeline_id) ?? []).map((e) => (
                        <li key={e.status_id} className="flex flex-wrap items-center justify-between gap-3 py-1">
                          <span className="text-sm text-gray2">
                            {e.nome}
                            {e.estagio_manual && <span className="ml-2 text-xs text-gray3">(definido à mão)</span>}
                          </span>
                          <SeletorEstagioEtapa pipelineId={e.pipeline_id} statusId={e.status_id} estagio={e.estagio} />
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray3">
            Tokens nas variáveis de ambiente do servidor (META_ACCESS_TOKEN, KOMMO_SUBDOMAIN, KOMMO_TOKEN, CRON_SECRET). Leads de funis “Fora” não entram em nenhuma BU.
          </p>
        </>
      )}
    </CardModulo>
  );
}
