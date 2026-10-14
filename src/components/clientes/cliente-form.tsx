"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CamposEndereco, type ValoresEndereco } from "@/components/clientes/campos-endereco";
import {
  Combobox,
  ComboboxInputGroup,
  ComboboxInput,
  ComboboxClear,
  ComboboxIcon,
  ComboboxPopup,
  ComboboxList,
  ComboboxEmpty,
  ComboboxItem,
} from "@/components/ui/combobox";
import { BlocoFormulario } from "@/components/pedido/bloco-formulario";
import { formatarCnpj } from "@/lib/clientes/formatacao";
import { salvarClienteAction, type SalvarClienteState } from "@/lib/clientes/serverActions";
import type { TipoCliente } from "@/lib/supabase/database.types";

const ESTADO_INICIAL: SalvarClienteState = {};

export interface ClienteFormValores {
  id: string;
  tipo: TipoCliente;
  razaoSocial: string;
  nomeFantasia: string | null;
  apelido: string | null;
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

export interface ContatoBlingOpcao {
  id: number;
  nome: string;
  cnpj: string;
}

export interface ValoresIniciaisBling {
  fantasia: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
}

interface ItemBusca {
  value: string;
  label: string;
}

export function ClienteForm({
  cliente,
  contatosBling = [],
  blingContatoIdInicial,
  valoresIniciaisBling,
}: {
  cliente?: ClienteFormValores;
  /** Contatos do Bling ainda sem cliente local vinculado — candidatos pro seletor. Só precisa vir preenchido quando ainda falta escolher um (cliente novo ou legado sem vínculo). */
  contatosBling?: ContatoBlingOpcao[];
  blingContatoIdInicial?: number;
  /** Nome fantasia/endereço já cadastrados no Bling pro blingContatoIdInicial — só sugestão de valor padrão, continua editável/salvável normalmente. */
  valoresIniciaisBling?: ValoresIniciaisBling | null;
}) {
  const [estado, formAction, pendente] = useActionState(salvarClienteAction, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<TipoCliente>(cliente?.tipo ?? "clube");
  const [nomeFantasia, setNomeFantasia] = useState(cliente?.nomeFantasia ?? valoresIniciaisBling?.fantasia ?? "");
  const [apelido, setApelido] = useState(cliente?.apelido ?? "");
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

  const contatoInicial = contatosBling.find((c) => c.id === (cliente?.blingContatoId ?? blingContatoIdInicial)) ?? null;
  const [contatoSelecionado, setContatoSelecionado] = useState<ContatoBlingOpcao | null>(contatoInicial);

  // Razão social/CNPJ só existem a partir do contato escolhido — já vinculado
  // (edição) ou já conhecido (veio de ?blingContatoId= ou foi selecionado
  // agora). Nunca são texto livre: o Bling é a única fonte dessa identidade.
  const razaoSocial = cliente?.razaoSocial ?? contatoSelecionado?.nome ?? "";
  const cnpj = cliente?.cnpj ?? contatoSelecionado?.cnpj ?? "";
  const blingContatoId = cliente?.blingContatoId ?? contatoSelecionado?.id ?? null;
  const contatoBloqueado = cliente != null && cliente.blingContatoId != null;

  const itensBusca: ItemBusca[] = contatosBling.map((c) => ({ value: String(c.id), label: `${c.nome} — ${formatarCnpj(c.cnpj)}` }));
  const buscaValue = contatoSelecionado ? { value: String(contatoSelecionado.id), label: contatoSelecionado.nome } : null;

  const payload = { clienteId: cliente?.id, blingContatoId, tipo, nomeFantasia, apelido, ...endereco, foroPreferencial };

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <BlocoFormulario numero={1} titulo="Dados do cliente" icon={Building2}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Contato no Bling</Label>
            {contatoBloqueado ? (
              <p className="text-sm">
                {razaoSocial} — {formatarCnpj(cnpj)}
              </p>
            ) : (
              <Combobox
                items={itensBusca}
                value={buscaValue as ItemBusca | null}
                onValueChange={(item) => {
                  const contato = item ? contatosBling.find((c) => String(c.id) === item.value) : null;
                  setContatoSelecionado(contato ?? null);
                }}
              >
                <ComboboxInputGroup>
                  <ComboboxInput placeholder="Buscar contato do Bling por nome ou CNPJ..." />
                  <ComboboxClear />
                  <ComboboxIcon />
                </ComboboxInputGroup>
                <ComboboxPopup>
                  <ComboboxEmpty>Nenhum contato encontrado — sincronize com o Bling em /clientes.</ComboboxEmpty>
                  <ComboboxList>
                    {(item: ItemBusca) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </Combobox>
            )}
            {!contatoBloqueado && (
              <p className="text-xs text-muted-foreground">
                Razão social e CNPJ vêm do Bling e não são digitados aqui. Não achou o contato? Sincronize em{" "}
                <Link href="/clientes" className="underline underline-offset-2">
                  /clientes
                </Link>{" "}
                e volte.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Perfil</Label>
              <Select value={tipo} onValueChange={(v) => setTipo((v as TipoCliente) ?? "clube")}>
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
              <Label>Nome fantasia</Label>
              <Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
            </div>
          </div>
          {tipo === "clube" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Apelido</Label>
                <Input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="ex.: Timão" />
              </div>
            </div>
          )}
          <CamposEndereco
            valores={endereco}
            aoAlterar={(campo, valor) => setEndereco((atual) => ({ ...atual, [campo]: valor }))}
            enderecoLegado={cliente?.enderecoLegado}
          />
          <div className="flex flex-col gap-2">
            <Label>Foro preferencial</Label>
            <Input value={foroPreferencial} onChange={(e) => setForoPreferencial(e.target.value)} required />
          </div>
        </div>
      </BlocoFormulario>

      <BlocoFormulario numero={2} titulo="Logo" descricao="Logo da agência ou escudo do clube." icon={ImagePlus}>
        <div className="flex items-center gap-4">
          {previewImagem ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou URL pública do Storage, sem otimização necessária
            <img src={previewImagem} alt="Prévia do logo" className="size-20 rounded-lg border border-border bg-muted object-contain p-1" />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
              <ImagePlus className="size-6" />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2">
            <Input
              type="file"
              name="imagem"
              accept="image/*"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) setPreviewImagem(URL.createObjectURL(arquivo));
              }}
            />
          </div>
        </div>
      </BlocoFormulario>

      {estado.erro && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{estado.erro}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" nativeButton={false} render={<Link href="/clientes">Cancelar</Link>} />
        <Button type="submit" disabled={pendente || !blingContatoId}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
