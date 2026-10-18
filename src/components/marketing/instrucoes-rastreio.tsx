"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MdCheckCircle,
  MdContentCopy,
  MdLink,
  MdWarningAmber,
} from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AbasFiltro } from "@/components/ds/alternadores";
import { PARAMETROS_META } from "@/lib/marketing/rastreio";

type Aba = "meta" | "google" | "email" | "outros";

export interface DiagnosticoRastreio {
  leadsMeta: number;
  leadsCrm: number;
  /** Criativos com leads na Meta e nenhum no CRM (provável falha de UTM/formulário). */
  semCrm: { nome: string; leadsMeta: number }[];
}

/**
 * Parâmetros de URL da Meta (campo "Parâmetros de URL" do anúncio). Os nomes
 * seguem a convenção que JÁ funciona nas contas (conferida em out/2026): o ID
 * da campanha em utm_campaign (o Make o copia para utm_campaign_id no Kommo),
 * o do conjunto em utm_term e o do anúncio em utm_content. Mudar a convenção
 * quebraria esse mapeamento.
 */
/** Sufixo do URL final do Google Ads (ValueTrack). */
const SUFIXO_GOOGLE =
  "utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={adgroupid}&utm_content={creative}";

const ORIGENS_OUTROS = [
  {
    valor: "instagram",
    rotulo: "Instagram orgânico (bio, stories, posts)",
    medium: "organic_social",
  },
  {
    valor: "whatsapp",
    rotulo: "WhatsApp (grupos, listas, atendimento)",
    medium: "messaging",
  },
  { valor: "linkedin", rotulo: "LinkedIn orgânico", medium: "organic_social" },
  {
    valor: "youtube",
    rotulo: "YouTube (descrição de vídeo)",
    medium: "organic_video",
  },
  { valor: "parceiro", rotulo: "Parceiro / influenciador", medium: "referral" },
  {
    valor: "qrcode",
    rotulo: "QR code (evento, material impresso)",
    medium: "offline",
  },
] as const;

function copiar(texto: string, rotulo = "Copiado") {
  navigator.clipboard.writeText(texto).then(
    () => toast.success(rotulo),
    () =>
      toast.error(
        "Não foi possível copiar — selecione o texto e copie manualmente.",
      ),
  );
}

function Codigo({
  texto,
  rotuloCopiar,
}: {
  texto: string;
  rotuloCopiar?: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray5 bg-surface-hover/60 p-3">
      <code className="min-w-0 flex-1 font-mono text-[12px] leading-relaxed break-all text-darkPurple1">
        {texto}
      </code>
      <Button
        type="button"
        variant="white"
        size="xs"
        onClick={() => copiar(texto, rotuloCopiar)}
      >
        <MdContentCopy className="size-3.5" />
        Copiar
      </Button>
    </div>
  );
}

function Passos({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-relaxed text-gray2">
      {itens.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ol>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
      {children}
    </h3>
  );
}

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Monta a URL de destino com os UTMs (mantém os parâmetros que já existirem). */
function montarUrl(destino: string, utms: Record<string, string>) {
  try {
    const url = new URL(
      destino.trim().match(/^https?:\/\//)
        ? destino.trim()
        : `https://${destino.trim()}`,
    );
    for (const [k, v] of Object.entries(utms))
      if (v) url.searchParams.set(k, v);
    return url.toString();
  } catch {
    return null;
  }
}

function GeradorLink({
  fonte,
  medium,
  campanhaPadrao,
  destinos,
  fixoFonte,
}: {
  fonte: string;
  medium: string;
  campanhaPadrao: string;
  destinos: string[];
  fixoFonte?: boolean;
}) {
  const [destino, setDestino] = useState(destinos[0] ?? "");
  const [origem, setOrigem] = useState(fonte);
  const [campanha, setCampanha] = useState(campanhaPadrao);
  const [conteudo, setConteudo] = useState("");
  const url = useMemo(
    () =>
      destino
        ? montarUrl(destino, {
            utm_source: slug(origem),
            utm_medium: medium,
            utm_campaign: slug(campanha),
            utm_content: slug(conteudo),
          })
        : null,
    [destino, origem, medium, campanha, conteudo],
  );
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray5 p-4">
      <span className="flex items-center gap-2 text-sm font-bold text-darkPurple1">
        <MdLink className="size-[18px]" /> Gerador de link
      </span>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray2 sm:col-span-2">
          Página de destino
          <Input
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="https://"
          />
        </label>
        {destinos.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
            <span className="text-xs text-gray3">
              Páginas dos anúncios desta campanha:
            </span>
            {destinos.slice(0, 6).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDestino(u)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${u === destino ? "border-darkPurple1 bg-darkPurple1 text-white" : "border-gray5 text-gray2 hover:bg-surface-hover"}`}
              >
                {u.replace(/^https?:\/\//, "")}
              </button>
            ))}
          </div>
        )}
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray2">
          Origem (utm_source)
          <Input
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            disabled={fixoFonte}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray2">
          Ação (utm_campaign)
          <Input
            value={campanha}
            onChange={(e) => setCampanha(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray2 sm:col-span-2">
          Peça ou posição (utm_content, opcional)
          <Input
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="ex.: botao-topo, link-bio, story-1"
          />
        </label>
      </div>
      {destino && !url && (
        <span className="text-xs text-red">Endereço inválido.</span>
      )}
      {url && <Codigo texto={url} rotuloCopiar="Link copiado" />}
    </div>
  );
}

// "Instruções de rastreio" do detalhe da campanha: como marcar os links em
// cada canal para que o lead chegue ao Kommo com a campanha e o criativo — a
// base da atribuição (ROAS, CAC, ranking). Abas: Meta, Google Ads, E-mail e
// Outros canais; a aba Meta traz o diagnóstico do rastreio desta campanha.
export function InstrucoesRastreio({
  campanhaNome,
  campanhaId,
  destinos,
  diagnostico,
}: {
  campanhaNome: string;
  campanhaId: string;
  /** Páginas de destino dos anúncios desta campanha (da Meta), da com mais gasto para a com menos. */
  destinos: string[];
  diagnostico: DiagnosticoRastreio;
}) {
  const [aba, setAba] = useState<Aba>("meta");
  const [origemOutros, setOrigemOutros] =
    useState<(typeof ORIGENS_OUTROS)[number]["valor"]>("instagram");
  const taxa = diagnostico.leadsMeta
    ? diagnostico.leadsCrm / diagnostico.leadsMeta
    : null;
  const outros = ORIGENS_OUTROS.find((o) => o.valor === origemOutros)!;

  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="white" size="sm" />}
      >
        <MdLink className="size-4" />
        Instruções de rastreio
      </DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Instruções de rastreio</DialogTitle>
          <DialogDescription>
            Como marcar os links para que cada lead chegue ao Kommo com a
            campanha e o criativo de origem — é isso que permite medir ROAS, CAC
            e comparar criativos.
          </DialogDescription>
        </DialogHeader>
        <AbasFiltro
          valor={aba}
          onChange={setAba}
          opcoes={[
            { valor: "meta", rotulo: "Meta" },
            { valor: "google", rotulo: "Google Ads" },
            { valor: "email", rotulo: "E-mail" },
            { valor: "outros", rotulo: "Outros canais" },
          ]}
        />

        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 pb-1">
          {aba === "meta" && (
            <>
              <section className="flex flex-col gap-2">
                <Titulo>Rastreio desta campanha hoje</Titulo>
                <div
                  className={`flex items-start gap-2.5 rounded-lg p-3 text-[13px] ${taxa !== null && taxa < 0.5 ? "bg-orange3 text-[#8a5a12]" : "bg-green5/70 text-green1"}`}
                >
                  {taxa !== null && taxa < 0.5 ? (
                    <MdWarningAmber className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <MdCheckCircle className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>
                    {taxa === null
                      ? "Sem leads da Meta no período."
                      : `${diagnostico.leadsCrm.toLocaleString("pt-BR")} de ${Math.round(diagnostico.leadsMeta).toLocaleString("pt-BR")} leads da Meta chegaram ao Kommo com esta campanha (${Math.round(taxa * 100)}%).`}
                    {diagnostico.semCrm.length > 0 && (
                      <>
                        {" "}
                        Criativos com leads na Meta e nenhum no Kommo — confira
                        os parâmetros e o formulário:{" "}
                        <strong className="font-semibold">
                          {diagnostico.semCrm
                            .map(
                              (c) => `${c.nome} (${Math.round(c.leadsMeta)})`,
                            )
                            .join("; ")}
                        </strong>
                        .
                      </>
                    )}
                  </span>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <Titulo>1. Parâmetros de URL em cada anúncio</Titulo>
                <Passos
                  itens={[
                    <>
                      No Gerenciador de Anúncios, abra o anúncio (nível{" "}
                      <strong>Anúncio</strong>, não a campanha).
                    </>,
                    <>
                      Em <strong>Rastreamento → Parâmetros de URL</strong>, cole
                      o texto abaixo. A Meta troca as chaves {"{{…}}"} pelos IDs
                      reais na hora do clique.
                    </>,
                    <>
                      Para aplicar em vários anúncios de uma vez: selecione-os
                      na lista, clique em <strong>Editar</strong> e cole no
                      mesmo campo.
                    </>,
                    <>
                      Ao duplicar anúncios ou criar novos, confira se o campo
                      veio preenchido — é a falha mais comum.
                    </>,
                  ]}
                />
                <Codigo
                  texto={PARAMETROS_META}
                  rotuloCopiar="Parâmetros da Meta copiados"
                />
                <p className="text-xs text-gray3">
                  Esta campanha:{" "}
                  <strong className="font-semibold text-gray2">
                    {campanhaNome}
                  </strong>{" "}
                  · ID {campanhaId}. Use os IDs (numéricos), não o nome: é por
                  eles que o sistema liga o lead à campanha e ao criativo.
                </p>
              </section>

              <section className="flex flex-col gap-2">
                <Titulo>2. Página de destino e formulário</Titulo>
                {destinos.length > 0 ? (
                  <div className="flex flex-col gap-1 rounded-lg border border-gray5 p-3 text-[13px]">
                    <span className="text-xs text-gray3">
                      Páginas para onde os anúncios desta campanha levam (lidas
                      da Meta) — todas precisam dos campos abaixo:
                    </span>
                    {destinos.map((u) => (
                      <a
                        key={u}
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold break-all text-purple-text hover:underline"
                      >
                        {u}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray3">
                    A Meta ainda não informou as páginas de destino desta
                    campanha (aparecem após a próxima sincronização).
                  </p>
                )}
                <Passos
                  itens={[
                    <>
                      O formulário da página precisa ter{" "}
                      <strong>campos ocultos</strong> que leiam os parâmetros da
                      URL e os enviem ao Kommo: <code>utm_source</code>,{" "}
                      <code>utm_medium</code>, <code>utm_campaign</code> (ID da
                      campanha), <code>utm_term</code> (ID do conjunto),{" "}
                      <code>utm_content</code> (ID do anúncio) e{" "}
                      <code>fbclid</code>. Hoje só cerca de 8% dos leads do
                      Kommo chegam com esses campos — é aqui que a maior parte
                      do rastreio se perde.
                    </>,
                    <>
                      <strong>Primeiro toque pago:</strong> na primeira visita
                      com <code>utm_campaign</code>, guarde esse valor num
                      cookie (ex.: 90 dias) e <strong>não sobrescreva</strong>{" "}
                      depois. Envie-o no campo oculto{" "}
                      <code>ftp_utm_campaign</code> — é o que define o CAC.
                    </>,
                    <>
                      Se o visitante navegar para outra página antes de
                      preencher, os parâmetros precisam ir junto (cookie ou
                      armazenamento local), senão o lead chega sem campanha.
                    </>,
                    <>
                      No Make/integração com o Kommo, mantenha o mapeamento
                      atual: <code>utm_campaign</code> também vai para{" "}
                      <code>utm_campaign_id</code> e <code>utm_content</code>{" "}
                      para <code>utm_ad_id</code>.
                    </>,
                  ]}
                />
              </section>

              <section className="flex flex-col gap-2">
                <Titulo>3. Formulário instantâneo (Lead Ads)</Titulo>
                <p className="text-[13px] leading-relaxed text-gray2">
                  Formulários instantâneos não passam por URL. Na integração
                  Meta → Kommo, envie os IDs que a Meta entrega junto com o lead
                  (<code>campaign_id</code>, <code>adset_id</code>,{" "}
                  <code>ad_id</code>) para os campos{" "}
                  <code>utm_campaign_id</code>, <code>utm_adset_id</code> e{" "}
                  <code>utm_ad_id</code> do lead.
                </p>
              </section>

              <section className="flex flex-col gap-2">
                <Titulo>4. Teste antes de rodar</Titulo>
                <Passos
                  itens={[
                    <>
                      Abra a pré-visualização do anúncio, clique e confira na
                      barra de endereço se os parâmetros aparecem com números
                      (não com {"{{…}}"}).
                    </>,
                    <>
                      Preencha o formulário com um lead de teste e veja no Kommo
                      se os campos UTM vieram preenchidos.
                    </>,
                  ]}
                />
              </section>
            </>
          )}

          {aba === "google" && (
            <>
              <section className="flex flex-col gap-2">
                <Titulo>Sufixo do URL final</Titulo>
                <Passos
                  itens={[
                    <>
                      No Google Ads, vá em{" "}
                      <strong>Configurações da conta</strong> (vale para todas
                      as campanhas) ou da campanha →{" "}
                      <strong>Opções de URL da campanha</strong> →{" "}
                      <strong>Sufixo do URL final</strong>.
                    </>,
                    <>
                      Cole o texto abaixo. O Google troca as chaves pelos
                      valores reais (ValueTrack) no clique.
                    </>,
                    <>
                      Mantenha a codificação automática (auto-tagging/gclid)
                      ligada — o campo oculto <code>gclid</code> do formulário
                      deve ir para o Kommo.
                    </>,
                  ]}
                />
                <Codigo
                  texto={SUFIXO_GOOGLE}
                  rotuloCopiar="Sufixo do Google copiado"
                />
              </section>
              <section className="flex flex-col gap-2">
                <Titulo>Página e formulário</Titulo>
                <p className="text-[13px] leading-relaxed text-gray2">
                  Os mesmos campos ocultos da aba Meta (incluindo o primeiro
                  toque em <code>ftp_utm_campaign</code>) e o <code>gclid</code>
                  . Use a mesma página de destino com o mesmo formulário.
                </p>
              </section>
              <div className="flex items-start gap-2.5 rounded-lg bg-orange3 p-3 text-[13px] text-[#8a5a12]">
                <MdWarningAmber className="mt-0.5 size-4 shrink-0" />
                <span>
                  O módulo de Marketing ainda lê só a mídia da Meta. Leads do
                  Google com estes parâmetros chegam ao Kommo corretamente
                  marcados, mas só entram nos indicadores quando o Google Ads
                  for conectado.
                </span>
              </div>
            </>
          )}

          {aba === "email" && (
            <>
              <section className="flex flex-col gap-2">
                <Titulo>Regras para e-mail</Titulo>
                <Passos
                  itens={[
                    <>
                      Use <code>utm_medium=email</code> e a ferramenta como{" "}
                      <code>utm_source</code> (ex.: <code>rdstation</code>,{" "}
                      <code>mailchimp</code>).
                    </>,
                    <>
                      Em <code>utm_campaign</code>, um nome curto da ação (ex.:{" "}
                      <code>agentes-lote2</code>).{" "}
                      <strong>Não use o ID de campanha da Meta</strong> em
                      e-mails — a venda seria atribuída à mídia paga sem ter
                      vindo dela.
                    </>,
                    <>
                      Marque <strong>todos</strong> os links do e-mail; use{" "}
                      <code>utm_content</code> para diferenciar botões (ex.:{" "}
                      <code>botao-topo</code>, <code>rodape</code>).
                    </>,
                    <>
                      Se a ferramenta adiciona UTMs automaticamente, confira se
                      não sobrescreve os seus.
                    </>,
                  ]}
                />
              </section>
              <GeradorLink
                fonte="rdstation"
                medium="email"
                campanhaPadrao={slug(campanhaNome)}
                destinos={destinos}
              />
            </>
          )}

          {aba === "outros" && (
            <>
              <section className="flex flex-col gap-2">
                <Titulo>Canal</Titulo>
                <AbasFiltro
                  valor={origemOutros}
                  onChange={setOrigemOutros}
                  opcoes={ORIGENS_OUTROS.map((o) => ({
                    valor: o.valor,
                    rotulo: o.rotulo,
                  }))}
                />
                <Passos
                  itens={[
                    <>
                      Todo link divulgado fora da mídia paga leva{" "}
                      <code>utm_source</code> (o canal), <code>utm_medium</code>{" "}
                      (o tipo) e <code>utm_campaign</code> (a ação). Sem isso o
                      lead chega como &ldquo;sem origem&rdquo;.
                    </>,
                    <>
                      Em bio do Instagram, WhatsApp e QR code, gere o link
                      abaixo e, se ficar longo, use um encurtador que preserve
                      os parâmetros.
                    </>,
                    <>
                      Para parceiros e influenciadores, gere um link por
                      parceiro (o nome dele em <code>utm_content</code>) — assim
                      dá para comparar quem traz venda.
                    </>,
                    <>
                      Não use o ID de campanha da Meta fora dos anúncios da
                      Meta.
                    </>,
                  ]}
                />
              </section>
              <GeradorLink
                key={outros.valor}
                fonte={outros.valor}
                medium={outros.medium}
                campanhaPadrao={slug(campanhaNome)}
                destinos={destinos}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
