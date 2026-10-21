"use client";

import { startTransition, useActionState, useMemo, useRef, useState, type FocusEvent } from "react";
import { MdBusiness } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxInputGroup, ComboboxInput, ComboboxClear, ComboboxIcon, ComboboxPopup, ComboboxList, ComboboxEmpty, ComboboxItem } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { BlocoFormulario } from "./bloco-formulario";
import { ResumoPedido, type IntencaoEnvio } from "./resumo-pedido";
import { SignatarioListEditor, type SignatarioForm } from "./signatario-list-editor";
import { PainelAlertas } from "./painel-alertas";
import { CamposEndereco } from "@/components/clientes/campos-endereco";
import { AvisoCnpjBling, DivergenciaBlingDialog, useVerificacaoCnpj } from "@/components/clientes/verificacao-bling";
import type { DadosEmpresa, DecisaoBling } from "@/lib/clientes/vinculoBling";
import { salvarPedido, type SalvarPedidoState } from "@/lib/pedidos/serverActions";
import { gerarAlertas, FORO_DEFAULT } from "@/lib/validacoes/pedido";
import { normalizePlan, listarPlanosCanonicos } from "@/lib/plans/normalize";
import { textoMultaDefault } from "@/lib/contratos/multa";
import { MEIOS_PAGAMENTO_DISPONIVEIS, ROTULO_MEIO_PAGAMENTO } from "@/lib/contratos/meioPagamento";
import type { MultaTipo, MeioPagamento, Divulgacao, ApiModelo, OrigemVenda, TipoVenda } from "@/lib/supabase/database.types";
import { ROTULO_ORIGEM_VENDA, ROTULO_TIPO_VENDA } from "@/lib/vendas/rotulos";

export interface ClienteOption {
  id: string;
  tipo: "clube" | "agente";
  razaoSocial: string;
  cnpj: string;
}
export interface RepresentanteFoutureOption {
  id: string;
  nome: string;
}
export interface UsuarioOption {
  id: string;
  nome: string;
}

export interface DadosIniciaisPedido {
  clienteId: string;
  nomePlanoImportado?: string;
  plano: string;
  planoLegadoNomeOriginal?: string | null;
  planoLegadoConfirmado?: boolean;
  incluiApi: boolean;
  licencasPagas: number;
  licencasGratuitas: number;
  formaPagamento: "avista" | "parcelado";
  meioPagamento: MeioPagamento;
  numeroParcelas: number;
  valorMensal: number;
  valorTotal: number;
  valorLicencaAdicional: number;
  valorMensalApi: number;
  valorMensalSoftware: number;
  primeiroPagamento: string;
  diaVencimento: number;
  convencaoParcelas: "calendario" | "ciclo";
  vigenciaInicio: string;
  vigenciaFim: string;
  robusta: boolean;
  divulgacao: Divulgacao;
  percentualDescontoDivulgacao?: number;
  postDivulgacao?: string;
  apiModelo: ApiModelo;
  multaTipo: MultaTipo;
  multaTexto: string;
  foro: string;
  condicaoEspecial: string;
  representantesLegais: SignatarioForm[];
  testemunhasCliente: SignatarioForm[];
  representantesFootureIds: string[];
  testemunhasFooture: SignatarioForm[];
  sdrId: string;
  closerId: string;
  tipoVenda: TipoVenda | null;
  origem: OrigemVenda | null;
  geraContrato: boolean;
  emailsFinanceiro: string[];
}

interface Props {
  clientes: ClienteOption[];
  signatariosPorCliente: Record<string, SignatarioForm[]>;
  representantesFooture: RepresentanteFoutureOption[];
  usuarios: UsuarioOption[];
  pedidoId?: string;
  dadosIniciais?: DadosIniciaisPedido;
}

// Campos numéricos partem de 0 — sem isso, clicar pra digitar deixa o "0" na
// frente do valor novo em vez de substituí-lo. `input type="number"` não
// suporta selection APIs de forma confiável entre navegadores (Safari não
// implementa .select() nesse tipo, é limitação de spec, não bug de lógica) —
// por isso esses campos usam type="text" + inputMode, com .select() no focus.
function selecionarConteudo(e: FocusEvent<HTMLInputElement>) {
  e.target.select();
}

function paraNumero(texto: string): number {
  const n = Number(texto);
  return Number.isNaN(n) ? 0 : n;
}

function somarMeses(dataISO: string, meses: number): string {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(ano, mes - 1 + meses, dia);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Rótulos exibidos no gatilho dos selects (sem `items`, o Select do base-ui
// mostra o valor cru, ex.: "parcelado" em vez de "Parcelado").
const ROTULOS_PERFIL = { clube: "Clube", agente: "Agente" };
const NAO_INFORMADO = "nao_informado";
const ROTULOS_FORMA = { parcelado: "Parcelado", avista: "À vista" };
const ROTULOS_API_MODELO = {
  combinado: "Combinado (um boleto só, valor somado)",
  distintos: "Boletos distintos (API e software separados)",
};
const ROTULOS_CONVENCAO = { calendario: "Calendário (padrão)", ciclo: "Ciclo" };
const ROTULOS_DIVULGACAO = {
  nenhuma: "Nenhuma",
  simples: "Simples (cliente autoriza citar como referência)",
  obrigacao: "Divulgação mútua (desconto opcional)",
};

const ESTADO_INICIAL: SalvarPedidoState = {};

export function PedidoForm({ clientes, signatariosPorCliente, representantesFooture, usuarios, pedidoId, dadosIniciais: d }: Props) {
  const [estado, formAction, pendente] = useActionState(salvarPedido, ESTADO_INICIAL);
  // Qual botão do resumo submeteu: o ref é lido no submit (síncrono, antes de
  // qualquer re-render); o state só alimenta o rótulo "Enviando…/Salvando…".
  const intencaoRef = useRef<IntencaoEnvio>("rascunho");
  const [envioAguardando, setEnvioAguardando] = useState<FormData | null>(null);
  const [intencao, setIntencao] = useState<IntencaoEnvio>("rascunho");
  function escolherIntencao(valor: IntencaoEnvio) {
    intencaoRef.current = valor;
    setIntencao(valor);
  }

  const [clienteId, setClienteId] = useState<string>(d?.clienteId ?? "");
  const [cadastrandoNovo, setCadastrandoNovo] = useState(!d && clientes.length === 0);
  const [novoCliente, setNovoCliente] = useState({
    tipo: "clube" as "clube" | "agente",
    razaoSocial: "",
    nomeFantasia: "",
    apelido: "",
    cnpj: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cep: "",
    municipio: "",
    uf: "",
  });
  const [previewLogoNovoCliente, setPreviewLogoNovoCliente] = useState<string | null>(null);
  const { resultado: verificacaoCnpj, verificando: verificandoCnpj, verificar: verificarCnpj } = useVerificacaoCnpj();
  function preencherComBling(dados: DadosEmpresa) {
    setNovoCliente({ ...novoCliente, ...dados, cnpj: novoCliente.cnpj });
  }
  function usarClienteExistente(id: string) {
    setCadastrandoNovo(false);
    setClienteId(id);
  }

  // Cliente novo já existe no Bling com dados diferentes: o servidor devolve a
  // comparação; a resposta reenvia o MESMO envio (com a logo) + decisaoBling.
  const ultimoEnvio = useRef<FormData | null>(null);
  const [divergenciaRespondida, setDivergenciaRespondida] = useState<SalvarPedidoState | null>(null);
  const divergenciaBling = estado.divergenciaBling && divergenciaRespondida !== estado ? estado.divergenciaBling : null;
  function decidirDivergencia(decisao: DecisaoBling) {
    setDivergenciaRespondida(estado);
    const formData = ultimoEnvio.current;
    if (!formData) return;
    formData.set("payload", JSON.stringify({ ...JSON.parse(String(formData.get("payload"))), decisaoBling: decisao }));
    startTransition(() => formAction(formData));
  }

  const [sdrId, setSdrId] = useState(d?.sdrId ?? "");
  const [closerId, setCloserId] = useState(d?.closerId ?? "");
  const [tipoVenda, setTipoVenda] = useState<string>(d?.tipoVenda ?? NAO_INFORMADO);
  const [origem, setOrigem] = useState<string>(d?.origem ?? NAO_INFORMADO);
  // 0040 — sem contrato, a aprovação envia ao Bling e conclui (sem jurídico/assinatura).
  const [geraContrato, setGeraContrato] = useState(d?.geraContrato ?? true);
  const [emailsFinanceiro, setEmailsFinanceiro] = useState<string[]>(d?.emailsFinanceiro ?? []);
  const [novoEmail, setNovoEmail] = useState("");
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  function adicionarEmail() {
    const email = novoEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErroEmail("E-mail inválido.");
    if (emailsFinanceiro.includes(email)) return setErroEmail("Esse e-mail já está na lista.");
    setEmailsFinanceiro([...emailsFinanceiro, email]);
    setNovoEmail("");
    setErroEmail(null);
  }

  const clienteSelecionado = clientes.find((c) => c.id === clienteId);
  const perfil: "clube" | "agente" = cadastrandoNovo ? novoCliente.tipo : (clienteSelecionado?.tipo ?? "clube");

  // Clientes já chegam ordenados por razão social (query em consultas.ts) — o combobox só filtra por rótulo.
  const clienteItens = useMemo(
    () => clientes.map((c) => ({ value: c.id, label: `${c.razaoSocial} (${c.tipo})` })),
    [clientes],
  );
  const clienteComboboxValue = clienteItens.find((i) => i.value === clienteId) ?? null;

  const [nomePlanoImportado, setNomePlanoImportado] = useState(d?.nomePlanoImportado ?? "");
  const [plano, setPlano] = useState(d?.plano ?? "");
  const [planoLegadoConfirmado, setPlanoLegadoConfirmado] = useState(d?.planoLegadoConfirmado ?? false);
  // NUNCA converte em silêncio — nome de geração anterior ou termo ambíguo (ex.:
  // "prime" pro agente) sempre exigem confirmação explícita (plan-registry.json).
  const normalizado = useMemo(
    () => (nomePlanoImportado.trim() ? normalizePlan(perfil, nomePlanoImportado) : null),
    [perfil, nomePlanoImportado],
  );

  const [incluiApi, setIncluiApi] = useState(d?.incluiApi ?? false);
  const [licencasPagas, setLicencasPagas] = useState(d?.licencasPagas ?? 1);
  const [licencasGratuitas, setLicencasGratuitas] = useState(d?.licencasGratuitas ?? 0);
  const [formaPagamento, setFormaPagamento] = useState<"avista" | "parcelado">(d?.formaPagamento ?? "parcelado");
  const [meioPagamento, setMeioPagamento] = useState<MeioPagamento>(d?.meioPagamento ?? "boleto");
  const [numeroParcelas, setNumeroParcelas] = useState(d?.numeroParcelas ?? 12);
  const [valorMensal, setValorMensal] = useState(d?.valorMensal ?? 0);

  // Valor total não é mais editável diretamente — é sempre a soma derivada da
  // parcela × nº de parcelas (parcelado) ou do próprio valor único (à vista).
  const valorTotal = useMemo(
    () => (formaPagamento === "parcelado" ? Number((valorMensal * numeroParcelas).toFixed(2)) : valorMensal),
    [formaPagamento, valorMensal, numeroParcelas],
  );
  const [valorLicencaAdicional, setValorLicencaAdicional] = useState(d?.valorLicencaAdicional ?? 0);
  const [valorMensalApi, setValorMensalApi] = useState(d?.valorMensalApi ?? 0);
  const [valorMensalSoftware, setValorMensalSoftware] = useState(d?.valorMensalSoftware ?? 0);
  const [primeiroPagamento, setPrimeiroPagamento] = useState(d?.primeiroPagamento ?? "");
  const [diaVencimento, setDiaVencimento] = useState(d?.diaVencimento ?? 10);
  const [convencaoParcelas, setConvencaoParcelas] = useState<"calendario" | "ciclo">(d?.convencaoParcelas ?? "calendario");
  const [vigenciaInicio, setVigenciaInicio] = useState(d?.vigenciaInicio ?? "");
  const [vigenciaFim, setVigenciaFim] = useState(d?.vigenciaFim ?? "");
  // Multa, linhagem (enxuta/robusta) e foro não são decisão do vendedor: seguem o
  // padrão do contrato (pedido novo) ou o que já estava salvo (edição) — ajustes
  // ficam com o jurídico, numa nova versão do contrato.
  const robusta = d?.robusta ?? false;
  // Padrão "simples" (revisão jurídica, set/2026): a cláusula de autorização de
  // divulgação deve constar por padrão, retirada só a pedido do cliente — "nenhuma"
  // vira uma escolha explícita do vendedor, não o caminho de menor esforço.
  const [divulgacao, setDivulgacao] = useState<Divulgacao>(d?.divulgacao ?? "simples");
  const [percentualDescontoDivulgacao, setPercentualDescontoDivulgacao] = useState(d?.percentualDescontoDivulgacao ?? 0);
  const [postDivulgacao, setPostDivulgacao] = useState(d?.postDivulgacao ?? "");
  const [apiModelo, setApiModelo] = useState<ApiModelo>(d?.apiModelo ?? "distintos");
  const multaTipo: MultaTipo = d?.multaTipo ?? "tres_mensalidades";
  const multaTexto = d?.multaTexto ?? textoMultaDefault("tres_mensalidades");
  const foro = d?.foro ?? FORO_DEFAULT;
  const [condicaoEspecial, setCondicaoEspecial] = useState(d?.condicaoEspecial ?? "");

  const [representantesLegais, setRepresentantesLegais] = useState<SignatarioForm[]>(d?.representantesLegais ?? []);
  const [testemunhasCliente, setTestemunhasCliente] = useState<SignatarioForm[]>(d?.testemunhasCliente ?? []);
  const [representantesFootureIds, setRepresentantesFootureIds] = useState<string[]>(d?.representantesFootureIds ?? []);
  const [testemunhasFooture, setTestemunhasFooture] = useState<SignatarioForm[]>(d?.testemunhasFooture ?? []);

  const alertas = useMemo(
    () =>
      gerarAlertas({
        valorMensal,
        valorTotal,
        formaPagamento,
        numeroParcelas,
        licencasGratuitas,
        foro,
        temRepresentanteLegal: !geraContrato || representantesLegais.length > 0,
        planoLegadoDetectado: normalizado?.status === "needs_confirmation",
        planoLegadoNomeOriginal: nomePlanoImportado || undefined,
        planoLegadoConfirmado,
      }),
    [
      valorMensal,
      valorTotal,
      formaPagamento,
      numeroParcelas,
      licencasGratuitas,
      foro,
      representantesLegais,
      geraContrato,
      normalizado,
      nomePlanoImportado,
      planoLegadoConfirmado,
    ],
  );

  const planosDisponiveis = useMemo(() => listarPlanosCanonicos(perfil), [perfil]);
  const rotulosPlano = useMemo(() => Object.fromEntries(planosDisponiveis.map((p) => [p.key, p.canonical])), [planosDisponiveis]);
  const rotulosUsuarios = useMemo(() => Object.fromEntries(usuarios.map((u) => [u.id, u.nome])), [usuarios]);
  const signatariosDoClienteSelecionado = clienteId ? (signatariosPorCliente[clienteId] ?? []) : [];

  function aoEnviar(formData: FormData) {
    const payload = {
      pedidoId,
      clienteId: cadastrandoNovo ? undefined : clienteId || undefined,
      novoCliente: cadastrandoNovo ? novoCliente : undefined,
      perfil,
      produtos: incluiApi ? ["footlink", "api"] : ["footlink"],
      plano,
      planoLegadoNomeOriginal: nomePlanoImportado || null,
      planoLegadoConfirmado,
      licencasPagas,
      licencasGratuitas,
      formaPagamento,
      meioPagamento,
      numeroParcelas: formaPagamento === "parcelado" ? numeroParcelas : undefined,
      valorMensal,
      valorTotal,
      valorLicencaAdicional: valorLicencaAdicional || undefined,
      valorMensalApi: incluiApi ? valorMensalApi : undefined,
      valorMensalSoftware: incluiApi ? valorMensalSoftware : undefined,
      primeiroPagamento,
      diaVencimento: formaPagamento === "parcelado" ? diaVencimento : undefined,
      convencaoParcelas,
      vigenciaInicio,
      vigenciaFim,
      robusta,
      divulgacao,
      percentualDescontoDivulgacao: divulgacao === "obrigacao" ? percentualDescontoDivulgacao : undefined,
      postDivulgacao: divulgacao === "obrigacao" ? postDivulgacao || undefined : undefined,
      apiModelo: incluiApi ? apiModelo : undefined,
      multaTipo,
      multaTexto,
      foro,
      condicaoEspecial: condicaoEspecial || undefined,
      representantesLegais,
      testemunhasCliente,
      representantesFootureIds,
      testemunhasFooture,
      sdrId,
      closerId,
      geraContrato,
      emailsFinanceiro,
      tipoVenda: tipoVenda === NAO_INFORMADO ? null : tipoVenda,
      origem: origem === NAO_INFORMADO ? null : origem,
    };
    formData.set("payload", JSON.stringify(payload));
    formData.set("intencao", intencaoRef.current);
    ultimoEnvio.current = formData;
    // Sem representante legal: em vez de alertar desde a abertura da tela,
    // pergunta no envio para aprovação (o rascunho salva sem perguntar).
    if (intencaoRef.current === "enviar" && geraContrato && representantesLegais.length === 0) {
      setEnvioAguardando(formData);
      return;
    }
    return formAction(formData);
  }

  function enviarMesmoAssim() {
    const formData = envioAguardando;
    setEnvioAguardando(null);
    if (formData) startTransition(() => formAction(formData));
  }

  function irParaSignatarios() {
    setEnvioAguardando(null);
    document.getElementById("signatarios")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Alerta de representante ausente vira o modal acima — fora do painel e da contagem do resumo.
  const alertasVisiveis = alertas.filter((a) => a.codigo !== "representante_ausente");

  const clienteNome = cadastrandoNovo ? novoCliente.razaoSocial : (clienteSelecionado?.razaoSocial ?? "");

  return (
    <form action={aoEnviar} className="grid grid-cols-1 items-start gap-5 pb-16 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <div className="flex flex-col gap-5">
        <PainelAlertas alertas={alertasVisiveis} />
        {estado.erro && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{estado.erro}</p>
        )}

        <BlocoFormulario titulo="Cliente" descricao="Quem está contratando o Footlink.">
          {!cadastrandoNovo ? (
            <div className="flex flex-col gap-2">
              <Label variante="campo">Cliente existente</Label>
              <Combobox items={clienteItens} value={clienteComboboxValue} onValueChange={(item) => setClienteId(item?.value ?? "")}>
                <ComboboxInputGroup>
                  <ComboboxInput placeholder="Buscar cliente por nome..." />
                  <ComboboxClear />
                  <ComboboxIcon />
                </ComboboxInputGroup>
                <ComboboxPopup>
                  <ComboboxEmpty>Nenhum cliente encontrado.</ComboboxEmpty>
                  <ComboboxList>
                    {(item: { value: string; label: string }) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </Combobox>
              <Button type="button" variant="link" className="self-start px-0" onClick={() => setCadastrandoNovo(true)}>
                + cadastrar novo cliente
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                <div className="flex flex-col gap-2">
                  <Label variante="campo">Perfil</Label>
                  <Select items={ROTULOS_PERFIL} value={novoCliente.tipo} onValueChange={(v) => setNovoCliente({ ...novoCliente, tipo: v as "clube" | "agente" })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clube">Clube</SelectItem>
                      <SelectItem value="agente">Agente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label variante="campo">CNPJ</Label>
                  <Input
                    value={novoCliente.cnpj}
                    onChange={(e) => setNovoCliente({ ...novoCliente, cnpj: e.target.value })}
                    onBlur={() => verificarCnpj(novoCliente)}
                  />
                </div>
              </div>
              <AvisoCnpjBling
                resultado={verificacaoCnpj}
                verificando={verificandoCnpj}
                aoPreencherComBling={preencherComBling}
                aoUsarClienteExistente={clientes.some((c) => c.id === verificacaoCnpj?.clienteLocal?.id) ? usarClienteExistente : undefined}
              />
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                <div className="flex flex-col gap-2">
                  <Label variante="campo">Razão social</Label>
                  <Input value={novoCliente.razaoSocial} onChange={(e) => setNovoCliente({ ...novoCliente, razaoSocial: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label variante="campo">Nome fantasia</Label>
                  <Input value={novoCliente.nomeFantasia} onChange={(e) => setNovoCliente({ ...novoCliente, nomeFantasia: e.target.value })} />
                </div>
              </div>
              {novoCliente.tipo === "clube" && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                  <div className="flex flex-col gap-2">
                    <Label variante="campo">Apelido</Label>
                    <Input
                      value={novoCliente.apelido}
                      onChange={(e) => setNovoCliente({ ...novoCliente, apelido: e.target.value })}
                      placeholder="ex.: Timão"
                    />
                  </div>
                </div>
              )}
              <CamposEndereco
                valores={novoCliente}
                aoAlterar={(campo, valor) => setNovoCliente({ ...novoCliente, [campo]: valor })}
              />
              <div className="flex flex-col gap-2">
                <Label variante="campo">Logo da agência ou escudo do clube</Label>
                <div className="flex items-center gap-4">
                  {previewLogoNovoCliente ? (
                    // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), sem otimização necessária
                    <img
                      src={previewLogoNovoCliente}
                      alt="Prévia do logo"
                      className="size-16 shrink-0 rounded-lg border border-border bg-muted object-contain p-1"
                    />
                  ) : (
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
                      <MdBusiness className="size-5" />
                    </div>
                  )}
                  <Input
                    type="file"
                    name="imagemNovoCliente"
                    accept="image/*"
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0];
                      if (arquivo) setPreviewLogoNovoCliente(URL.createObjectURL(arquivo));
                    }}
                  />
                </div>
              </div>
              {clientes.length > 0 && (
                <Button type="button" variant="link" className="self-start px-0" onClick={() => setCadastrandoNovo(false)}>
                  usar cliente existente em vez disso
                </Button>
              )}
            </div>
          )}
        </BlocoFormulario>

        <BlocoFormulario titulo="Produto e plano" descricao="O que foi vendido e em qual escala.">
          <div className="flex items-center gap-2">
            <Checkbox checked disabled />
            <Label>Assinatura Footlink (sempre incluída)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={incluiApi} onCheckedChange={(v) => setIncluiApi(!!v)} />
            <Label>+ API</Label>
          </div>

          {perfil === "agente" && (
            <div className="flex flex-col gap-2">
              <Label variante="campo">Plano no pedido original</Label>
              <p className="-mt-1 text-xs text-gray3">Preencha só se o pedido veio de um contrato antigo/legado.</p>
              <Input
                value={nomePlanoImportado}
                onChange={(e) => {
                  setNomePlanoImportado(e.target.value);
                  setPlanoLegadoConfirmado(false);
                }}
                placeholder="ex.: Latam"
              />
              {normalizado?.status === "needs_confirmation" && (
                <div className="flex flex-col gap-2 rounded-lg border border-orange/40 bg-orange3 p-3 text-sm text-gray2">
                  <span>{normalizado.reason}</span>
                  <div className="flex flex-wrap gap-2">
                    {normalizado.candidates.map((c) => (
                      <Button
                        key={c.key}
                        type="button"
                        size="sm"
                        onClick={() => {
                          setPlano(c.key);
                          setPlanoLegadoConfirmado(true);
                        }}
                      >
                        Confirmar: {c.canonical}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {normalizado?.status === "unknown" && (
                <p className="text-sm text-destructive">{normalizado.reason}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label variante="campo">Plano</Label>
            <Select items={rotulosPlano} value={plano} onValueChange={(v) => setPlano(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {planosDisponiveis.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.canonical}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <div className="flex flex-col gap-2">
              <Label variante="campo">Licenças pagas</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={licencasPagas}
                onChange={(e) => setLicencasPagas(paraNumero(e.target.value))}
                onFocus={selecionarConteudo}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo">Licenças gratuitas</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={licencasGratuitas}
                onChange={(e) => setLicencasGratuitas(paraNumero(e.target.value))}
                onFocus={selecionarConteudo}
              />
            </div>
          </div>
        </BlocoFormulario>

        <BlocoFormulario titulo="Pagamento" descricao="Como e quando o cliente paga.">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <div className="flex flex-col gap-2">
              <Label variante="campo">Forma de pagamento</Label>
              <Select items={ROTULOS_FORMA} value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as "avista" | "parcelado")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="avista">À vista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo">Meio de pagamento</Label>
              <Select items={ROTULO_MEIO_PAGAMENTO} value={meioPagamento} onValueChange={(v) => v && setMeioPagamento(v as MeioPagamento)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEIOS_PAGAMENTO_DISPONIVEIS.map((valor) => [valor, ROTULO_MEIO_PAGAMENTO[valor]] as const).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {incluiApi && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 rounded-lg border border-gray5 p-4">
              <div className="col-span-full flex flex-col gap-2">
                <Label variante="campo">Modelo de cobrança da API</Label>
                <Select items={ROTULOS_API_MODELO} value={apiModelo} onValueChange={(v) => v && setApiModelo(v as ApiModelo)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="combinado">Combinado (um boleto só, valor somado)</SelectItem>
                    <SelectItem value="distintos">Boletos distintos (API e software separados)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label variante="campo">Valor mensal da API</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valorMensalApi}
                  onChange={(e) => {
                    const v = paraNumero(e.target.value);
                    setValorMensalApi(v);
                    setValorMensal(v + valorMensalSoftware);
                  }}
                  onFocus={selecionarConteudo}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label variante="campo">Valor mensal do software</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valorMensalSoftware}
                  onChange={(e) => {
                    const v = paraNumero(e.target.value);
                    setValorMensalSoftware(v);
                    setValorMensal(v + valorMensalApi);
                  }}
                  onFocus={selecionarConteudo}
                />
              </div>
              <p className="col-span-full text-xs text-gray3">
                {apiModelo === "distintos"
                  ? "API e software aparecem discriminados no contrato, cada um com seu boleto."
                  : "API e software aparecem somados num único valor mensal no contrato."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {formaPagamento === "parcelado" && (
              <div className="flex flex-col gap-2">
                <Label variante="campo">Número de parcelas</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={numeroParcelas}
                  onChange={(e) => setNumeroParcelas(paraNumero(e.target.value))}
                  onFocus={selecionarConteudo}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label variante="campo">Valor da parcela</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={valorMensal}
                onChange={(e) => setValorMensal(paraNumero(e.target.value))}
                onFocus={selecionarConteudo}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo">
                Valor total{formaPagamento === "parcelado" ? " (parcela × número de parcelas)" : ""}
              </Label>
              <Input type="text" inputMode="decimal" value={valorTotal} disabled />
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo">Valor da licença adicional</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={valorLicencaAdicional}
                onChange={(e) => setValorLicencaAdicional(paraNumero(e.target.value))}
                onFocus={selecionarConteudo}
              />
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <div className="flex flex-col gap-2">
              <Label variante="campo">{formaPagamento === "parcelado" ? "Data do primeiro pagamento" : "Data do pagamento"}</Label>
              <Input type="date" value={primeiroPagamento} onChange={(e) => setPrimeiroPagamento(e.target.value)} />
            </div>
            {formaPagamento === "parcelado" && (
              <>
                <div className="flex flex-col gap-2">
                  <Label variante="campo">Dia de vencimento recorrente</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(paraNumero(e.target.value))}
                    onFocus={selecionarConteudo}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label variante="campo">Convenção de parcelas</Label>
                  <Select items={ROTULOS_CONVENCAO} value={convencaoParcelas} onValueChange={(v) => setConvencaoParcelas(v as "calendario" | "ciclo")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendario">Calendário (padrão)</SelectItem>
                      <SelectItem value="ciclo">Ciclo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label variante="campo" htmlFor="email-financeiro">
              E-mails do financeiro do cliente
            </Label>
            <div className="flex gap-2">
              <Input
                id="email-financeiro"
                type="email"
                placeholder="financeiro@cliente.com.br"
                value={novoEmail}
                onChange={(e) => {
                  setNovoEmail(e.target.value);
                  setErroEmail(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarEmail();
                  }
                }}
              />
              <Button type="button" variant="white" onClick={adicionarEmail}>
                Adicionar
              </Button>
            </div>
            {erroEmail && <p className="text-xs text-destructive">{erroEmail}</p>}
            {emailsFinanceiro.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {emailsFinanceiro.map((email) => (
                  <li key={email} className="flex items-center gap-1.5 rounded-full border border-gray5 bg-page py-1 pr-1.5 pl-3 text-sm text-darkPurple1">
                    {email}
                    <button
                      type="button"
                      aria-label={`Remover ${email}`}
                      className="flex size-5 items-center justify-center rounded-full text-gray3 hover:bg-gray5 hover:text-darkPurple1"
                      onClick={() => setEmailsFinanceiro(emailsFinanceiro.filter((x) => x !== email))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray3">Vai para as observações internas do pedido no Bling, para a cobrança. Pode adicionar mais de um.</p>
            )}
          </div>
        </BlocoFormulario>

        <BlocoFormulario titulo="Contrato" descricao="Se este pedido gera contrato com o cliente.">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox id="gera-contrato" checked={geraContrato} onCheckedChange={(v) => setGeraContrato(!!v)} />
              <Label htmlFor="gera-contrato">Gerar contrato para este pedido</Label>
            </div>
            <p className="text-xs text-gray3">
              {geraContrato
                ? "Após a aprovação da diretoria, o pedido vai para o Bling e o contrato é gerado para validação do jurídico e assinatura."
                : "Sem contrato (ex.: alguns agentes): após a aprovação da diretoria, o pedido vai direto para o Bling e é concluído — sem jurídico nem assinatura."}
            </p>
          </div>
        </BlocoFormulario>

        <BlocoFormulario titulo="Vigência" descricao="Início e fim do contrato.">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <div className="flex flex-col gap-2">
              <Label variante="campo">Vigência — início</Label>
              <Input
                type="date"
                value={vigenciaInicio}
                onChange={(e) => {
                  setVigenciaInicio(e.target.value);
                  if (!vigenciaFim || vigenciaFim === somarMeses(vigenciaInicio, 12)) {
                    setVigenciaFim(somarMeses(e.target.value, 12));
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo">Vigência — fim</Label>
              <Input type="date" value={vigenciaFim} onChange={(e) => setVigenciaFim(e.target.value)} />
            </div>
          </div>
        </BlocoFormulario>

        <BlocoFormulario
          titulo="Cláusulas negociáveis"
          descricao="Divulgação da parceria e condições especiais. Multa, foro e as demais cláusulas seguem o padrão do contrato."
        >
          <div className="flex flex-col gap-2">
            <Label variante="campo">Divulgação da parceria</Label>
            <Select items={ROTULOS_DIVULGACAO} value={divulgacao} onValueChange={(v) => v && setDivulgacao(v as Divulgacao)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                <SelectItem value="simples">Simples (cliente autoriza citar como referência)</SelectItem>
                <SelectItem value="obrigacao">Divulgação mútua (desconto opcional)</SelectItem>
              </SelectContent>
            </Select>
            {divulgacao === "obrigacao" && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 rounded-lg border border-gray5 p-4">
                <div className="flex flex-col gap-2">
                  <Label variante="campo">Percentual de desconto combinado</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={percentualDescontoDivulgacao}
                    onChange={(e) => setPercentualDescontoDivulgacao(paraNumero(e.target.value))}
                    onFocus={selecionarConteudo}
                  />
                  <p className="text-xs text-muted-foreground">
                    5% se a parcela for menor que R$ 1.000, 10% se for maior ou igual — só narrativo/auditoria, o
                    valor já descontado é o que você preencheu acima em valor da parcela/total.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label variante="campo">Descrição do post (opcional)</Label>
                  <Textarea
                    value={postDivulgacao}
                    onChange={(e) => setPostDivulgacao(e.target.value)}
                    rows={2}
                    placeholder="ex.: uma imagem promocional com texto de divulgação da parceria"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label variante="campo">Condição especial</Label>
            <Textarea value={condicaoEspecial} onChange={(e) => setCondicaoEspecial(e.target.value)} rows={2} />
          </div>
        </BlocoFormulario>

        {geraContrato && (
          <>
        <div id="signatarios" className="scroll-mt-[90px]">
        <BlocoFormulario titulo="Signatários" descricao="Quem assina pelo cliente e pela Footure.">
          <SignatarioListEditor
            titulo="Representantes legais do cliente"
            itens={representantesLegais}
            onChange={setRepresentantesLegais}
            disponiveisParaReaproveitar={signatariosDoClienteSelecionado.filter((s) => !testemunhasCliente.some((t) => t.id === s.id))}
          />
          <SignatarioListEditor
            titulo="Testemunhas do cliente"
            itens={testemunhasCliente}
            onChange={setTestemunhasCliente}
            disponiveisParaReaproveitar={signatariosDoClienteSelecionado.filter((s) => !representantesLegais.some((r) => r.id === s.id))}
          />

          <Separator />

          <div className="flex flex-col gap-2">
            <Label variante="campo">Representante(s) da Footure</Label>
            {representantesFooture.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Checkbox
                  checked={representantesFootureIds.includes(r.id)}
                  onCheckedChange={(v) =>
                    setRepresentantesFootureIds((prev) => (v ? [...prev, r.id] : prev.filter((id) => id !== r.id)))
                  }
                />
                <Label>{r.nome}</Label>
              </div>
            ))}
          </div>

          <SignatarioListEditor titulo="Testemunhas da Footure" itens={testemunhasFooture} onChange={setTestemunhasFooture} />
        </BlocoFormulario>
        </div>
          </>
        )}

        <BlocoFormulario
          titulo="Dados comerciais"
          descricao="Tipo e origem da venda, e SDR e Closer — que definem a comissão de cada um sobre esse pedido (podem ser a mesma pessoa)."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label variante="campo">Tipo de venda</Label>
              <Select items={{ [NAO_INFORMADO]: "Não informado", ...ROTULO_TIPO_VENDA }} value={tipoVenda} onValueChange={(v) => v && setTipoVenda(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NAO_INFORMADO}>Não informado</SelectItem>
                  {Object.entries(ROTULO_TIPO_VENDA).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo">Origem</Label>
              <Select items={{ [NAO_INFORMADO]: "Não informado", ...ROTULO_ORIGEM_VENDA }} value={origem} onValueChange={(v) => v && setOrigem(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NAO_INFORMADO}>Não informado</SelectItem>
                  {Object.entries(ROTULO_ORIGEM_VENDA).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo">SDR</Label>
              <Select items={rotulosUsuarios} value={sdrId} onValueChange={(v) => v && setSdrId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo">Closer</Label>
              <Select items={rotulosUsuarios} value={closerId} onValueChange={(v) => v && setCloserId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </BlocoFormulario>
      </div>

      <ResumoPedido
        clienteNome={clienteNome}
        perfil={perfil}
        plano={plano}
        incluiApi={incluiApi}
        valorTotal={valorTotal}
        valorMensal={valorMensal}
        formaPagamento={formaPagamento}
        meioPagamento={meioPagamento}
        numeroParcelas={numeroParcelas}
        vigenciaInicio={vigenciaInicio}
        vigenciaFim={vigenciaFim}
        qtdAlertas={alertasVisiveis.length}
        geraContrato={geraContrato}
        pendente={pendente}
        intencao={intencao}
        aoEscolherIntencao={escolherIntencao}
      />

      <Dialog open={!!envioAguardando} onOpenChange={(aberto) => !aberto && setEnvioAguardando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedido sem representante legal</DialogTitle>
            <DialogDescription>
              Nenhum representante legal do cliente foi cadastrado. O pedido pode seguir para aprovação, mas o contrato não poderá ser liberado para
              assinatura sem isso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="white" onClick={irParaSignatarios}>
              Preencher dados
            </Button>
            <Button type="button" onClick={enviarMesmoAssim}>
              Enviar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DivergenciaBlingDialog
        divergencia={divergenciaBling}
        pendente={pendente}
        aoDecidir={decidirDivergencia}
        aoCancelar={() => setDivergenciaRespondida(estado)}
      />
    </form>
  );
}
