// Carregando a Visão A: blocos no formato da tela.
function Bloco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl border border-gray5 bg-surface ${className}`} />;
}

export default function CarregandoMarketing() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando o desempenho de campanhas">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-32 animate-pulse rounded bg-gray5" />
        <div className="h-8 w-[360px] max-w-full animate-pulse rounded bg-gray5" />
      </div>
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bloco key={i} className="h-[130px]" />
        ))}
      </div>
      <Bloco className="h-[70px]" />
      <Bloco className="h-[420px]" />
    </div>
  );
}
