// Carregando o relatório do curso: blocos no formato da tela final.
function Bloco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl border border-gray5 bg-surface ${className}`} />;
}

export default function CarregandoCurso() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando relatório do curso">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-48 animate-pulse rounded bg-gray5" />
        <div className="h-8 w-[420px] max-w-full animate-pulse rounded bg-gray5" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Bloco className="h-[260px]" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Bloco key={i} className="h-[150px]" />
          ))}
        </div>
      </div>
      <Bloco className="h-[360px]" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Bloco className="h-[280px]" />
        <Bloco className="h-[280px]" />
      </div>
      <Bloco className="h-[400px]" />
    </div>
  );
}
