"use client";

import { useRouter } from "next/navigation";
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

interface ItemBusca {
  value: string;
  label: string;
}

interface ClienteBusca {
  blingContatoId: number;
  clienteId: string | null;
  razaoSocial: string;
  nomeFantasia: string | null;
}

export function BuscaClientes({ clientes }: { clientes: ClienteBusca[] }) {
  const router = useRouter();
  const destinoPorValue = new Map(
    clientes.map((c) => [String(c.blingContatoId), c.clienteId ? `/clientes/${c.clienteId}` : `/clientes/bling/${c.blingContatoId}`]),
  );
  const itens: ItemBusca[] = clientes.map((c) => ({
    value: String(c.blingContatoId),
    label: c.nomeFantasia ? `${c.razaoSocial} (${c.nomeFantasia})` : c.razaoSocial,
  }));

  return (
    <Combobox
      items={itens}
      value={null as ItemBusca | null}
      onValueChange={(item) => {
        const destino = item && destinoPorValue.get(item.value);
        if (destino) router.push(destino);
      }}
    >
      <ComboboxInputGroup className="max-w-sm">
        <ComboboxInput placeholder="Buscar cliente por nome..." />
        <ComboboxClear />
        <ComboboxIcon />
      </ComboboxInputGroup>
      <ComboboxPopup>
        <ComboboxEmpty>Nenhum cliente encontrado.</ComboboxEmpty>
        <ComboboxList>
          {(item: ItemBusca) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
