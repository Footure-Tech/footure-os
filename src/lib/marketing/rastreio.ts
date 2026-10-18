// Verificação do rastreio (tagueamento) das campanhas — regras puras, usadas
// no servidor e na tela. Convenção que JÁ funciona nas contas (conferida em
// out/2026): ID da campanha em utm_campaign (o Make copia para
// utm_campaign_id no Kommo), do conjunto em utm_term e do anúncio em
// utm_content (o Make copia para utm_ad_id). O primeiro toque pago vai em
// ftp_utm_campaign (cookie na página).

/** "Parâmetros de URL" a colar em cada anúncio da Meta. */
export const PARAMETROS_META = "utm_source=meta&utm_medium=cpc&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}";

export type StatusRastreio = "ok" | "alerta" | "erro";

export interface ProblemaTag {
  gravidade: "erro" | "alerta";
  texto: string;
}

/** Valor de um parâmetro em "a=1&b=2" (sem decodificar as chaves {{…}}). */
function parametro(tags: string, nome: string) {
  const par = tags
    .replace(/^\?/, "")
    .split("&")
    .map((p) => p.split("="))
    .find(([k]) => k?.trim().toLowerCase() === nome);
  return par ? (par[1] ?? "").trim() : null;
}

const ehId = (v: string | null, macro: string) => !!v && (v.includes(`{{${macro}}}`) || /^\d+$/.test(v));

/**
 * Avalia os "Parâmetros de URL" de um anúncio. Aceita as duas convenções em
 * uso nas contas (out/2026): IDs em utm_campaign/utm_term/utm_content (o Make
 * copia para os campos *_id) ou IDs direto em utm_campaign_id/utm_adset_id/
 * utm_ad_id. Erro: sem parâmetros, ou sem o ID da campanha ou do anúncio (o
 * lead não é atribuído). Alerta: sem o conjunto ou a origem.
 */
export function avaliarTagsAnuncio(urlTags: string | null): { status: StatusRastreio; problemas: ProblemaTag[] } {
  if (!urlTags?.trim()) return { status: "erro", problemas: [{ gravidade: "erro", texto: "Anúncio sem “Parâmetros de URL” — nenhum lead dele chega ao Kommo com campanha ou criativo." }] };
  const p = (n: string) => parametro(urlTags, n);
  const problemas: ProblemaTag[] = [];
  if (!ehId(p("utm_campaign_id"), "campaign.id") && !ehId(p("utm_campaign"), "campaign.id"))
    problemas.push({ gravidade: "erro", texto: "Falta o ID da campanha: utm_campaign={{campaign.id}} (ou utm_campaign_id={{campaign.id}})." });
  if (!ehId(p("utm_ad_id"), "ad.id") && !ehId(p("utm_content"), "ad.id"))
    problemas.push({ gravidade: "erro", texto: "Falta o ID do anúncio: utm_content={{ad.id}} (ou utm_ad_id={{ad.id}}) — sem ele o criativo não aparece no ranking." });
  if (!ehId(p("utm_adset_id"), "adset.id") && !ehId(p("utm_term"), "adset.id")) problemas.push({ gravidade: "alerta", texto: "Falta o ID do conjunto: utm_term={{adset.id}} (ou utm_adset_id={{adset.id}})." });
  if (!p("utm_source")) problemas.push({ gravidade: "alerta", texto: "Falta utm_source=meta." });
  return { status: problemas.some((x) => x.gravidade === "erro") ? "erro" : problemas.length ? "alerta" : "ok", problemas };
}

// ─────────────────────────── Ponta a ponta ───────────────────────────

/**
 * Campos do lead conferidos no teste de ponta a ponta. Alguns existem em dois
 * campos no Kommo (o antigo e o novo) — vale o primeiro preenchido.
 * `etapa` diz onde corrigir quando o campo não chega.
 */
export const CAMPOS_PONTA_A_PONTA = [
  { chave: "utm_source", rotulo: "utm_source", ids: [1077799, 285148], etapa: "pagina" },
  { chave: "utm_medium", rotulo: "utm_medium", ids: [1077801, 285144], etapa: "pagina" },
  { chave: "utm_campaign", rotulo: "utm_campaign (ID da campanha)", ids: [1029722, 285146], etapa: "pagina" },
  { chave: "utm_term", rotulo: "utm_term (ID do conjunto)", ids: [1029728, 285150], etapa: "pagina" },
  { chave: "utm_content", rotulo: "utm_content (ID do anúncio)", ids: [285142], etapa: "pagina" },
  { chave: "utm_campaign_id", rotulo: "utm_campaign_id (usado pelo sistema)", ids: [1077803], etapa: "make" },
  { chave: "utm_ad_id", rotulo: "utm_ad_id (usado pelo sistema)", ids: [1077807], etapa: "make" },
  { chave: "ftp_utm_campaign", rotulo: "ftp_utm_campaign (primeiro toque)", ids: [1077815], etapa: "primeiro_toque" },
] as const;

export type ChaveCampo = (typeof CAMPOS_PONTA_A_PONTA)[number]["chave"];

export interface ResultadoCampo {
  chave: ChaveCampo;
  rotulo: string;
  esperado: string;
  recebido: string | null;
  ok: boolean;
  /** Primeiro toque: só alerta (pode já existir um cookie de outra campanha no navegador do teste). */
  alerta?: boolean;
  correcao?: string;
}

const CORRECAO: Record<(typeof CAMPOS_PONTA_A_PONTA)[number]["etapa"], string> = {
  pagina:
    "A página não está levando este parâmetro ao Kommo: confira se o formulário tem o campo oculto com este nome, se ele lê o valor da URL (inclusive depois de navegar entre páginas) e se a integração o envia ao Kommo.",
  make: "O valor chegou ao Kommo no campo de origem, mas não foi copiado para o campo que o sistema lê: no Make, mapeie utm_campaign → utm_campaign_id e utm_content → utm_ad_id.",
  primeiro_toque:
    "O primeiro toque não está sendo gravado: na primeira visita com utm_campaign, a página deve guardar o valor num cookie (sem sobrescrever depois) e enviá-lo no campo oculto ftp_utm_campaign.",
};

/** Confere os campos do lead de teste contra o esperado. */
export function conferirLead(recebido: Partial<Record<ChaveCampo, string | null>>, esperado: Partial<Record<ChaveCampo, string>>): ResultadoCampo[] {
  return CAMPOS_PONTA_A_PONTA.filter((c) => esperado[c.chave] !== undefined).map((c) => {
    const valor = recebido[c.chave]?.trim() || null;
    const ok = valor !== null && valor.toLowerCase() === esperado[c.chave]!.toLowerCase();
    // Primeiro toque com outro valor (cookie anterior no navegador) é alerta, não erro.
    const alerta = c.chave === "ftp_utm_campaign" && !ok && valor !== null;
    return {
      chave: c.chave,
      rotulo: c.rotulo,
      esperado: esperado[c.chave]!,
      recebido: valor,
      ok,
      alerta,
      correcao: ok
        ? undefined
        : alerta
          ? "Chegou um primeiro toque de outra campanha — provavelmente um cookie anterior neste navegador. Repita o teste numa janela anônima para confirmar."
          : CORRECAO[c.etapa],
    };
  });
}

/** Status final: problema se algum campo falhou (alerta do primeiro toque não reprova). */
export const statusDoResultado = (r: ResultadoCampo[]): "ok" | "problema" => (r.some((c) => !c.ok && !c.alerta) ? "problema" : "ok");

/** Rótulo e tom da verificação de ponta a ponta (servidor e cliente). */
export const VISUAL_VERIFICACAO = {
  ok: { rotulo: "Ponta a ponta OK", tom: "active" },
  problema: { rotulo: "Ponta a ponta com problema", tom: "inactive" },
  aguardando: { rotulo: "Aguardando o lead de teste", tom: "pending" },
} as const;
