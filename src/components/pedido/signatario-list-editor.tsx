"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SignatarioForm {
  id?: string;
  nomeCompleto: string;
  email: string;
  cpf: string;
}

interface Props {
  titulo: string;
  itens: SignatarioForm[];
  onChange: (itens: SignatarioForm[]) => void;
  /** Signatários já cadastrados no cliente, oferecidos para reaproveitar. */
  disponiveisParaReaproveitar?: SignatarioForm[];
}

const VAZIO: SignatarioForm = { nomeCompleto: "", email: "", cpf: "" };

export function SignatarioListEditor({ titulo, itens, onChange, disponiveisParaReaproveitar }: Props) {
  function atualizar(idx: number, campo: keyof SignatarioForm, valor: string) {
    const copia = itens.slice();
    copia[idx] = { ...copia[idx], [campo]: valor };
    onChange(copia);
  }

  function remover(idx: number) {
    onChange(itens.filter((_, i) => i !== idx));
  }

  function adicionarVazio() {
    onChange([...itens, { ...VAZIO }]);
  }

  function adicionarExistente(id: string) {
    const existente = disponiveisParaReaproveitar?.find((s) => s.id === id);
    if (existente && !itens.some((i) => i.id === id)) onChange([...itens, existente]);
  }

  const reaproveitaveis = (disponiveisParaReaproveitar ?? []).filter((d) => !itens.some((i) => i.id === d.id));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-darkPurple1">{titulo}</h3>
        {reaproveitaveis.length > 0 && (
          <select
            className="h-8 rounded-md border bg-background px-2 text-xs"
            value=""
            onChange={(e) => e.target.value && adicionarExistente(e.target.value)}
          >
            <option value="">+ reaproveitar do cadastro do cliente…</option>
            {reaproveitaveis.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nomeCompleto}
              </option>
            ))}
          </select>
        )}
      </div>

      {itens.length === 0 && <p className="text-xs text-muted-foreground">Nenhum cadastrado ainda.</p>}

      {itens.map((item, idx) => (
        <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-gray5 p-3 sm:grid-cols-[1fr_1fr_140px_auto]">
          <div className="flex flex-col gap-1">
            <Label variante="campo">Nome completo</Label>
            <Input value={item.nomeCompleto} onChange={(e) => atualizar(idx, "nomeCompleto", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label variante="campo">E-mail</Label>
            <Input type="email" value={item.email} onChange={(e) => atualizar(idx, "email", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label variante="campo">CPF</Label>
            <Input value={item.cpf} onChange={(e) => atualizar(idx, "cpf", e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => remover(idx)}>
              Remover
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={adicionarVazio} className="self-start">
        + Adicionar
      </Button>
    </div>
  );
}
