# Prompt sugerido para o Claude Code (Antigravity)

Copie a pasta `design_handoff_footure_gestao/` para a raiz do repositório `footure-os` e cole o prompt abaixo.

---

Leia `design_handoff_footure_gestao/README.md` por completo e abra `design_handoff_footure_gestao/prototype/Footure Gestao.dc.html` como referência visual e de comportamento.

Objetivo: aplicar ao `footure-os` a nova estrutura de navegação, UI e experiência descritas no handoff, **preservando toda a lógica de negócio, APIs, modelos de dados, autenticação e integrações existentes (Clicksign e Bling)**. O HTML é referência de design — não copie o código; recrie usando o framework, componentes e padrões que já existem no projeto.

Antes de alterar qualquer coisa:
1. Mapeie a estrutura atual do projeto (framework, roteamento, biblioteca de UI, gerenciamento de estado, sistema de estilos, como os perfis/permissões funcionam).
2. Liste as telas existentes e relacione cada uma com as telas do handoff (Dashboard, Leads, Pedidos, Novo pedido, Negócio, Contratos, Contratos e parcelas, Inadimplência). Aponte o que já existe, o que falta e o que conflita.
3. Proponha um plano em etapas e aguarde minha aprovação.

Ordem de implementação sugerida (um PR/commit por etapa):
1. Tokens do Footlink Design System (cores, tipografia Barlow, raios, sombras) e tema claro/escuro via `body[data-theme]` persistido em `localStorage` (`footlink_theme`).
2. App shell: AppBar, Sidebar por módulo com visibilidade por perfil, cabeçalho de página padrão, toast.
3. Componentes base: Card, KPI card, Tabela, StatusPill (com o mapeamento de status do README), Badge de linha de receita, abas de filtro, stepper.
4. Telas na ordem do fluxo: Leads (Kanban + Tabela) → Pedidos + Novo pedido → Negócio (visão ponta-a-ponta) → Contratos (Jurídico) → Financeiro → Inadimplência → Dashboard (os dois layouts, alternáveis).
5. Ligar as ações contextuais de avanço de etapa aos serviços reais (Clicksign, Bling) que já existem.

Regras:
- Textos em português, conforme o README (títulos, descrições, rótulos e mensagens de toast).
- Não invente dados; use as fontes reais do sistema. Onde um dado do protótipo não existir no backend, sinalize em vez de mockar.
- Valide cada tela nos temas claro e escuro e em larguras estreitas (~900px).
