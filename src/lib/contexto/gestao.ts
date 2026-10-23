// Aba "Gestão" da AppBar (só Diretoria): telas exclusivas da Diretoria —
// Controladoria e Administração. Não é um contexto de dados como Footlink e
// Academy (cookie): a aba fica ativa pela rota, e as telas de lá usam os dados
// da empresa inteira. Módulo neutro (Server e Client Components).
export const ROTAS_GESTAO = ["/controladoria", "/admin/usuarios", "/admin/configuracoes"];
export const ENTRADA_GESTAO = "/controladoria";

export const emGestao = (pathname: string) => ROTAS_GESTAO.some((r) => pathname === r || pathname.startsWith(`${r}/`));
