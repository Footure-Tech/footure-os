import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarCliente, urlLogoCliente } from "@/lib/clientes/consultas";
import { listarPedidosDoCliente } from "@/lib/pedidos/consultas";
import { buscarVisaoBlingDoCliente, buscarDetalheContatoBling, classificarSituacaoParcela, type SituacaoParcela } from "@/lib/integracoes/bling";
import { calcularSituacaoCliente, ROTULO_SITUACAO_CLIENTE, VARIANTE_SITUACAO_CLIENTE } from "@/lib/clientes/situacao";
import { formatarCnpj, formatarEnderecoCliente } from "@/lib/clientes/formatacao";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { RotuloStatus } from "@/components/rotulo-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Datas vêm como "aaaa-mm-dd" — divide a string em vez de usar Date pra não
 * sofrer o deslocamento de fuso horário do parse UTC-meia-noite. */
function formatarDataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

const ROTULO_SITUACAO_PARCELA: Record<SituacaoParcela, string> = {
  recebida: "Recebida",
  recebida_parcial: "Recebida parcialmente",
  atrasada: "Atrasada",
  em_aberto: "Em aberto",
};

const VARIANTE_SITUACAO_PARCELA: Record<SituacaoParcela, "success" | "destructive" | "neutral" | "info"> = {
  recebida: "success",
  recebida_parcial: "info",
  atrasada: "destructive",
  em_aberto: "neutral",
};

export default async function ClienteDetalhePage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const cliente = await buscarCliente(supabase, id);
  if (!cliente) notFound();

  const pedidosLocais = await listarPedidosDoCliente(supabase, id);
  const visaoBling = await buscarVisaoBlingDoCliente(supabase, cliente.cnpj);
  const classificacoesBling = visaoBling.pedidos.flatMap((p) =>
    p.parcelas.map((parcela) => classificarSituacaoParcela(parcela.situacao, parcela.vencimento)),
  );
  const temParcelaAtrasadaBling = classificacoesBling.includes("atrasada");
  const temParcelaAVencerBling = classificacoesBling.includes("em_aberto");
  const { situacao, contratoVigente } = calcularSituacaoCliente(
    pedidosLocais,
    temParcelaAtrasadaBling,
    temParcelaAVencerBling,
    visaoBling.pedidos.length,
  );

  // Bling é a base oficial de razão social/nome fantasia/CNPJ/endereço — a
  // cópia local só existe pra preencher o cadastro e eventualmente alimentar
  // a criação de pedido de venda, nunca pra exibição aqui.
  const detalheBling = cliente.bling_contato_id ? await buscarDetalheContatoBling(supabase, cliente.bling_contato_id) : null;
  const razaoSocialExibida = detalheBling?.nome ?? cliente.razao_social;
  const nomeFantasiaExibido = detalheBling?.fantasia ?? cliente.nome_fantasia;
  const cnpjExibido = detalheBling?.cnpj ?? cliente.cnpj;
  const enderecoExibido = formatarEnderecoCliente(detalheBling ?? cliente);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <LogoCliente url={urlLogoCliente(supabase, cliente.logo_path)} nome={razaoSocialExibida} tamanho="md" />
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">{razaoSocialExibida}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="capitalize">
                {cliente.tipo}
              </Badge>
              {nomeFantasiaExibido && <span>{nomeFantasiaExibido}</span>}
              <span>{formatarCnpj(cnpjExibido)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={VARIANTE_SITUACAO_CLIENTE[situacao]}>{ROTULO_SITUACAO_CLIENTE[situacao]}</Badge>
          <Button variant="secondary" size="sm" nativeButton={false} render={<Link href={`/clientes/${cliente.id}/editar`}>Editar</Link>} />
        </div>
      </div>

      {contratoVigente && (
        <p className="text-sm text-muted-foreground">
          Contrato vigente até <span className="font-medium text-foreground">{formatarDataBr(contratoVigente.vigencia_fim)}</span>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados do cliente</CardTitle>
          {!detalheBling && (
            <CardDescription>
              Sem vínculo com um contato do Bling — mostrando dados locais, que podem estar desatualizados ou incompletos.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Endereço</p>
            <p>{enderecoExibido}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Foro preferencial</p>
            <p>{cliente.foro_preferencial}</p>
          </div>
          {cliente.apelido && (
            <div>
              <p className="text-muted-foreground">Apelido</p>
              <p>{cliente.apelido}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contratos</CardTitle>
          <CardDescription>Pedidos deste cliente no Footlink.</CardDescription>
        </CardHeader>
        <CardContent>
          {pedidosLocais.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido cadastrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Valor mensal</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosLocais.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.plano}</TableCell>
                    <TableCell>
                      <RotuloStatus status={p.status} />
                    </TableCell>
                    <TableCell>
                      {formatarDataBr(p.vigencia_inicio)} a {formatarDataBr(p.vigencia_fim)}
                    </TableCell>
                    <TableCell>{formatarMoeda(p.valor_mensal)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/pedidos/${p.id}`}>Ver</Link>} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
          <CardDescription>
            {!visaoBling.conectado && "Bling não conectado — conecte em Configurações para ver o status de pagamento."}
            {visaoBling.conectado &&
              !visaoBling.contatoEncontrado &&
              "Nenhum contato com este CNPJ foi encontrado no Bling."}
            {visaoBling.conectado &&
              visaoBling.contatoEncontrado &&
              visaoBling.pedidos.length === 0 &&
              "Nenhum pedido de venda encontrado no Bling para este cliente."}
          </CardDescription>
        </CardHeader>
        {visaoBling.pedidos.length > 0 && (
          <CardContent className="flex flex-col gap-3">
            {visaoBling.pedidos.map((pedido, indice) => (
              // Lista já vem ordenada por data desc — o pedido mais recente é a
              // melhor aproximação do "contrato vigente" (não existe vínculo
              // explícito entre pedido local e pedido de venda do Bling) e fica
              // expandido; os demais (contratos encerrados) começam recolhidos.
              <details key={pedido.id} className="group rounded-lg border border-border" open={indice === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 select-none">
                  <p className="text-sm font-medium">
                    Pedido de venda #{pedido.numero} — {pedido.descricaoItens || "sem descrição"}
                  </p>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {formatarMoeda(pedido.total)}
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="border-t border-border px-4 py-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedido.parcelas.map((parcela) => {
                        const classe = classificarSituacaoParcela(parcela.situacao, parcela.vencimento);
                        return (
                          <TableRow key={parcela.id}>
                            <TableCell>{formatarDataBr(parcela.vencimento)}</TableCell>
                            <TableCell>{formatarMoeda(parcela.valor)}</TableCell>
                            <TableCell>
                              <Badge variant={VARIANTE_SITUACAO_PARCELA[classe]}>{ROTULO_SITUACAO_PARCELA[classe]}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </details>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
