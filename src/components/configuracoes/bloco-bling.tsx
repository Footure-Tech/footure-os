import { MdLink, MdSync } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ds/status-pill";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function BlocoBling({
  conectado,
  expiresAt,
  atualizadoEm,
}: {
  conectado: boolean;
  expiresAt: string | null;
  atualizadoEm: string | null;
}) {
  return (
    <CardModulo
      icone={MdSync}
      cor="bg-iconYellow"
      titulo="Bling"
      extra={<StatusPill tom={conectado ? "active" : "inactive"}>{conectado ? "Conectado" : "Não conectado"}</StatusPill>}
    >
      <p className="-mt-1 text-sm text-gray">ERP da Footure — base de clientes, pedidos de venda e contas a receber.</p>
      {conectado && (
        <div className="flex flex-col">
          {atualizadoEm && <LinhaChaveValor rotulo="Conectado desde" valor={formatarData(atualizadoEm)} />}
          {expiresAt && <LinhaChaveValor rotulo="Token válido até" valor={formatarData(expiresAt)} />}
        </div>
      )}
      {conectado && <p className="text-xs text-gray3">O token de acesso é renovado automaticamente quando necessário.</p>}
      <Button variant={conectado ? "white" : "default"} className="self-start" nativeButton={false} render={<a href="/api/integracoes/bling/conectar" />}>
        <MdLink className="size-[18px]" />
        {conectado ? "Reconectar" : "Conectar ao Bling"}
      </Button>
    </CardModulo>
  );
}
