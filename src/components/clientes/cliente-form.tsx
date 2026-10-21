"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import Link from "next/link";
import { MdImage } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CamposEndereco, type ValoresEndereco } from "@/components/clientes/campos-endereco";
import { AvisoCnpjBling, DivergenciaBlingDialog, useVerificacaoCnpj } from "@/components/clientes/verificacao-bling";
import { BlocoFormulario } from "@/components/pedido/bloco-formulario";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { formatarCnpj } from "@/lib/clientes/formatacao";
import { salvarClienteAction, type SalvarClienteState } from "@/lib/clientes/serverActions";
import type { TipoCliente } from "@/lib/supabase/database.types";
import type { DadosEmpresa, DecisaoBling } from "@/lib/clientes/vinculoBling";

const ESTADO_INICIAL: SalvarClienteState = {};
const ROTULOS_PERFIL: Record<TipoCliente, string> = { clube: "Clube", agente: "Agente" };

export interface ClienteFormValores {
  id: string;
  tipo: TipoCliente;
  razaoSocial: string;
  nomeFantasia: string | null;
  apelido: string | null;
  footlinkOrgId: string | null;
  cnpj: string;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  enderecoLegado: string | null;
  foroPreferencial: string;
  logoUrl: string | null;
  blingContatoId: number | null;
}

export interface ValoresIniciaisBling {
  nome: string;
  cnpj: string;
  fantasia: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
}

export function ClienteForm({
  cliente,
  valoresIniciaisBling,
}: {
  cliente?: ClienteFormValores;
  /** Contato do Bling escolhido na lista de contatos sem cadastro (?blingContatoId=) — só valor padrão, continua editável. */
  valoresIniciaisBling?: ValoresIniciaisBling | null;
}) {
  const [estado, formAction, pendente] = useActionState(salvarClienteAction, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<TipoCliente>(cliente?.tipo ?? "clube");
  const [nomeFantasia, setNomeFantasia] = useState(cliente?.nomeFantasia ?? valoresIniciaisBling?.fantasia ?? "");
  const [apelido, setApelido] = useState(cliente?.apelido ?? "");
  const [footlinkOrgId, setFootlinkOrgId] = useState(cliente?.footlinkOrgId ?? "");
  const [endereco, setEndereco] = useState<ValoresEndereco>({
    endereco: cliente?.endereco ?? valoresIniciaisBling?.endereco ?? "",
    numero: cliente?.numero ?? valoresIniciaisBling?.numero ?? "",
    complemento: cliente?.complemento ?? valoresIniciaisBling?.complemento ?? "",
    bairro: cliente?.bairro ?? valoresIniciaisBling?.bairro ?? "",
    cep: cliente?.cep ?? valoresIniciaisBling?.cep ?? "",
    municipio: cliente?.municipio ?? valoresIniciaisBling?.municipio ?? "",
    uf: cliente?.uf ?? valoresIniciaisBling?.uf ?? "",
  });
  const [foroPreferencial, setForoPreferencial] = useState(cliente?.foroPreferencial ?? "Porto Alegre/RS");
  const [previewImagem, setPreviewImagem] = useState<string | null>(cliente?.logoUrl ?? null);
  const [nomeImagem, setNomeImagem] = useState<string | null>(null);
  const entradaImagem = useRef<HTMLInputElement>(null);

  // Já vinculado: razão social/CNPJ seguem o Bling e ficam travados. Sem
  // vínculo (novo ou legado): digitados e conferidos no Bling ao salvar —
  // cadastrados lá se não existirem (lib/clientes/vinculoBling.ts).
  const vinculado = cliente != null && cliente.blingContatoId != null;
  const [razaoSocial, setRazaoSocial] = useState(cliente?.razaoSocial ?? valoresIniciaisBling?.nome ?? "");
  const [cnpj, setCnpj] = useState(cliente?.cnpj ?? valoresIniciaisBling?.cnpj ?? "");
  const { resultado: verificacao, verificando, verificar } = useVerificacaoCnpj(cliente?.id);

  const dadosEmpresa: DadosEmpresa = { razaoSocial, nomeFantasia, cnpj, ...endereco };

  function preencherComBling(d: DadosEmpresa) {
    setRazaoSocial(d.razaoSocial);
    setNomeFantasia(d.nomeFantasia);
    setEndereco({ endereco: d.endereco, numero: d.numero, complemento: d.complemento, bairro: d.bairro, cep: d.cep, municipio: d.municipio, uf: d.uf });
  }

  // Último envio, pra reenviar com a decisão quando o Bling diverge (o FormData carrega a logo escolhida).
  const ultimoEnvio = useRef<FormData | null>(null);
  const [divergenciaRespondida, setDivergenciaRespondida] = useState<SalvarClienteState | null>(null);
  const divergencia = estado.divergenciaBling && divergenciaRespondida !== estado ? estado.divergenciaBling : null;

  function enviar(formData: FormData, decisaoBling?: DecisaoBling) {
    const payload = { clienteId: cliente?.id, razaoSocial, cnpj, decisaoBling, tipo, nomeFantasia, apelido, footlinkOrgId, ...endereco, foroPreferencial };
    formData.set("payload", JSON.stringify(payload));
    ultimoEnvio.current = formData;
    formAction(formData);
  }

  function decidirDivergencia(decisao: DecisaoBling) {
    setDivergenciaRespondida(estado);
    const formData = ultimoEnvio.current;
    if (formData) startTransition(() => enviar(formData, decisao));
  }

  const nomeExibido = nomeFantasia || razaoSocial;
  const bloqueadoPorDuplicado = !vinculado && !!verificacao?.clienteLocal;

  return (
    <form action={(fd) => enviar(fd)} className="grid grid-cols-1 items-start gap-5 pb-16 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <div className="flex flex-col gap-5">
        {estado.erro && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{estado.erro}</p>
        )}

        <BlocoFormulario
          titulo="Empresa"
          descricao={
            vinculado
              ? "Razão social e CNPJ vêm do Bling — a base oficial da identidade do cliente."
              : "O CNPJ é conferido no Bling ao salvar: se já existir, o cliente é vinculado ao contato; se não, o contato é cadastrado lá."
          }
        >
          {vinculado ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 rounded-lg bg-page px-4 py-3">
              <div className="flex flex-col gap-1">
                <Label variante="campo">Razão social</Label>
                <span className="text-sm font-semibold text-darkPurple1">{razaoSocial}</span>
              </div>
              <div className="flex flex-col gap-1">
                <Label variante="campo">CNPJ</Label>
                <span className="text-sm font-semibold text-darkPurple1">{formatarCnpj(cnpj)}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                <div className="flex flex-col gap-2">
                  <Label variante="campo">CNPJ</Label>
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} onBlur={() => verificar(dadosEmpresa)} required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label variante="campo">Razão social</Label>
                  <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} required />
                </div>
              </div>
              <AvisoCnpjBling resultado={verificacao} verificando={verificando} aoPreencherComBling={preencherComBling} />
            </div>
          )}
        </BlocoFormulario>

        <BlocoFormulario titulo="Perfil e contrato" descricao="Como o cliente aparece no sistema e nos contratos.">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <div className="flex flex-col gap-2">
              <Label variante="campo">Perfil</Label>
              <Select items={ROTULOS_PERFIL} value={tipo} onValueChange={(v) => setTipo((v as TipoCliente) ?? "clube")}>
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
              <Label variante="campo">Nome fantasia</Label>
              <Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
            </div>
            {tipo === "clube" && (
              <div className="flex flex-col gap-2">
                <Label variante="campo">Apelido</Label>
                <Input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="ex.: Timão" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label variante="campo">Foro preferencial</Label>
              <Input value={foroPreferencial} onChange={(e) => setForoPreferencial(e.target.value)} required />
            </div>
          </div>
        </BlocoFormulario>

        <BlocoFormulario titulo="Conta no Footlink" descricao="Liga este cadastro à conta do cliente na plataforma Footlink. Não existe no Bling.">
          <div className="flex flex-col gap-2 sm:max-w-sm">
            <Label variante="campo" htmlFor="footlink-org-id">
              ID da organização no Footlink
            </Label>
            <Input
              id="footlink-org-id"
              value={footlinkOrgId}
              onChange={(e) => setFootlinkOrgId(e.target.value)}
              placeholder="Opcional"
              autoComplete="off"
              className="font-mono placeholder:font-sans"
            />
            <p className="text-xs text-gray3">Deixe em branco se o cliente ainda não tem conta no Footlink.</p>
          </div>
        </BlocoFormulario>

        <BlocoFormulario titulo="Endereço" descricao="Usado na qualificação do cliente no contrato.">
          <CamposEndereco
            valores={endereco}
            aoAlterar={(campo, valor) => setEndereco((atual) => ({ ...atual, [campo]: valor }))}
            enderecoLegado={cliente?.enderecoLegado}
          />
        </BlocoFormulario>
      </div>

      <aside className="flex flex-col gap-4 rounded-xl border border-gray5 bg-surface p-6 shadow-card lg:sticky lg:top-[90px]">
        <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Resumo do cliente</span>
        <div className="flex items-center gap-3">
          <LogoCliente url={previewImagem} nome={nomeExibido || "Cliente"} tamanho="md" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-xl font-bold text-darkPurple1">{nomeExibido || "Contato não selecionado"}</span>
            <span className="text-sm text-gray">{[ROTULOS_PERFIL[tipo], cnpj && formatarCnpj(cnpj)].filter(Boolean).join(" · ")}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-y border-gray5 py-4">
          <Label variante="campo">Logo</Label>
          <p className="text-xs text-gray3">Logo da agência ou escudo do clube (PNG, JPG ou SVG).</p>
          <input
            ref={entradaImagem}
            type="file"
            name="imagem"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) {
                setPreviewImagem(URL.createObjectURL(arquivo));
                setNomeImagem(arquivo.name);
              }
            }}
          />
          <Button type="button" variant="white" className="w-full" onClick={() => entradaImagem.current?.click()}>
            <MdImage className="size-4" />
            {previewImagem ? "Trocar logo" : "Escolher logo"}
          </Button>
          {nomeImagem && <span className="truncate text-xs text-gray3">{nomeImagem} — salva junto com o cadastro</span>}
        </div>

        <Button type="submit" disabled={pendente || bloqueadoPorDuplicado || (!vinculado && (!razaoSocial.trim() || !cnpj.trim()))} className="w-full">
          {pendente ? "Salvando…" : cliente ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
        <Button type="button" variant="white" className="w-full" nativeButton={false} render={<Link href={cliente ? `/clientes/${cliente.id}` : "/clientes"} />}>
          Cancelar
        </Button>
      </aside>

      <DivergenciaBlingDialog divergencia={divergencia} pendente={pendente} aoDecidir={decidirDivergencia} aoCancelar={() => setDivergenciaRespondida(estado)} />
    </form>
  );
}
