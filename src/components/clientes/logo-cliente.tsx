import { MdBusiness } from "react-icons/md";
import { cn } from "@/lib/utils";

const DIMENSAO = { sm: "size-9", lg: "size-[52px]", md: "size-16" } as const;
const ICONE = { sm: "size-4", lg: "size-6", md: "size-6" } as const;

// Logo/escudo do cliente num container branco (nos dois temas) com borda
// cinza arredondada — object-contain, nunca recorta o escudo como um avatar
// circular faria.
export function LogoCliente({
  url,
  nome,
  tamanho = "sm",
  className,
}: {
  url: string | null;
  nome: string;
  tamanho?: keyof typeof DIMENSAO;
  className?: string;
}) {
  if (!url) {
    return (
      <div
        className={cn(
          DIMENSAO[tamanho],
          "flex shrink-0 items-center justify-center rounded-lg border border-dashed border-gray5 bg-light text-gray3",
          className,
        )}
      >
        <MdBusiness className={ICONE[tamanho]} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage, sem otimização necessária
    <img
      src={url}
      alt={`Logo de ${nome}`}
      className={cn(DIMENSAO[tamanho], "shrink-0 rounded-lg border border-gray5 bg-white object-contain p-1", className)}
    />
  );
}
