// Barra de progresso 6px verde + "feito/total" (handoff: parcelas pagas).
export function BarraProgresso({ feito, total, largura = "w-24" }: { feito: number; total: number; largura?: string }) {
  const pct = total > 0 ? Math.round((feito / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-1.5 ${largura} overflow-hidden rounded-full bg-gray5`}>
        <span className="block h-full rounded-full bg-green2" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[13px] font-semibold text-gray2">
        {feito}/{total}
      </span>
    </div>
  );
}
