import { cn } from "@/lib/utils";

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

// Avatar do Footlink DS: círculo lilás com iniciais roxas (fonte = 36% do
// tamanho). Com `src` (ex.: logo do cliente) mostra a imagem.
export function Avatar({ nome, tamanho = 36, src, className }: { nome: string; tamanho?: number; src?: string | null; className?: string }) {
  return (
    <span
      title={nome}
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-lightPurple4 font-bold text-purple-text", className)}
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.36) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos vêm do Storage do Supabase (URL assinada/pública), sem otimização
        <img src={src} alt={nome} className="size-full object-cover" />
      ) : (
        iniciais(nome)
      )}
    </span>
  );
}
