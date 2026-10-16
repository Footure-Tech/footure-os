import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ValoresEndereco {
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
}

/** Campos de endereço no padrão do Bling (endereco.geral) — reaproveitado no
 * cadastro de cliente (cliente-form.tsx) e no sub-cadastro embutido no
 * formulário de pedido (pedido-form.tsx). */
export function CamposEndereco({
  valores,
  aoAlterar,
  enderecoLegado,
}: {
  valores: ValoresEndereco;
  aoAlterar: (campo: keyof ValoresEndereco, valor: string) => void;
  /** Texto livre de antes da migração 0023 — mostrado como referência enquanto os campos estruturados estão vazios. */
  enderecoLegado?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {enderecoLegado && !valores.endereco && (
        <p className="rounded-lg bg-orange3 px-3 py-2 text-xs font-semibold text-[#ce9232]">
          Endereço cadastrado antes da integração estruturada (referência): {enderecoLegado}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label variante="campo">Logradouro</Label>
          <Input value={valores.endereco} onChange={(e) => aoAlterar("endereco", e.target.value)} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label variante="campo">Número</Label>
          <Input value={valores.numero} onChange={(e) => aoAlterar("numero", e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label variante="campo">Complemento</Label>
          <Input value={valores.complemento} onChange={(e) => aoAlterar("complemento", e.target.value)} placeholder="Opcional" />
        </div>
        <div className="flex flex-col gap-2">
          <Label variante="campo">Bairro</Label>
          <Input value={valores.bairro} onChange={(e) => aoAlterar("bairro", e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label variante="campo">CEP</Label>
          <Input value={valores.cep} onChange={(e) => aoAlterar("cep", e.target.value)} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label variante="campo">Município</Label>
          <Input value={valores.municipio} onChange={(e) => aoAlterar("municipio", e.target.value)} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label variante="campo">UF</Label>
          <Input value={valores.uf} onChange={(e) => aoAlterar("uf", e.target.value.toUpperCase())} maxLength={2} required />
        </div>
      </div>
    </div>
  );
}
