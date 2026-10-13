import { createClient } from "@/lib/supabase/server";
import { buscarConfiguracaoComissionamento } from "@/lib/comissao/configuracoes";
import { buscarStatusBling } from "@/lib/integracoes/bling";
import { BlocoComissionamento } from "@/components/configuracoes/bloco-comissionamento";
import { BlocoBling } from "@/components/configuracoes/bloco-bling";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const MENSAGEM_BLING: Record<string, { titulo: string; variant: "default" | "destructive" }> = {
  conectado: { titulo: "Bling conectado com sucesso.", variant: "default" },
  erro: { titulo: "Falha ao conectar com o Bling — veja os logs do servidor.", variant: "destructive" },
  erro_state: { titulo: "Falha de validação (state) ao conectar com o Bling — tente novamente.", variant: "destructive" },
};

export default async function ConfiguracoesPage({ searchParams }: PageProps<"/admin/configuracoes">) {
  const { bling } = await searchParams;
  const supabase = await createClient();
  const [comissionamento, statusBling] = await Promise.all([
    buscarConfiguracaoComissionamento(supabase),
    buscarStatusBling(supabase),
  ]);

  const mensagemBling = typeof bling === "string" ? MENSAGEM_BLING[bling] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Configurações</h1>

      {mensagemBling && (
        <Alert variant={mensagemBling.variant}>
          {mensagemBling.variant === "destructive" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertTitle>{mensagemBling.titulo}</AlertTitle>
        </Alert>
      )}

      <BlocoComissionamento
        percentualImposto={comissionamento.percentual_imposto}
        percentualComissaoTotal={comissionamento.percentual_comissao_total}
        percentualComissaoSdr={comissionamento.percentual_comissao_sdr}
        percentualComissaoCloser={comissionamento.percentual_comissao_closer}
      />

      <BlocoBling conectado={statusBling.conectado} expiresAt={statusBling.expiresAt} atualizadoEm={statusBling.atualizadoEm} />
    </div>
  );
}
