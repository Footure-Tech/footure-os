import { Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" strokeWidth={2} />
          <CardTitle>Bling</CardTitle>
        </div>
        <CardDescription>Integração com o ERP — cria o pedido de venda correspondente quando um pedido é aprovado.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={conectado ? "success" : "destructive"}>{conectado ? "Conectado" : "Não conectado"}</Badge>
          {conectado && atualizadoEm && <span className="text-xs text-muted-foreground">desde {formatarData(atualizadoEm)}</span>}
        </div>
        {conectado && expiresAt && (
          <p className="text-xs text-muted-foreground">
            Token de acesso válido até {formatarData(expiresAt)} — renovado automaticamente quando necessário.
          </p>
        )}
        <Button variant="secondary" size="sm" className="self-start" nativeButton={false} render={<a href="/api/integracoes/bling/conectar" />}>
          <Link2 className="size-4" />
          {conectado ? "Reconectar" : "Conectar ao Bling"}
        </Button>
      </CardContent>
    </Card>
  );
}
