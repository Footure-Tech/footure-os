# Handoff: Footure Gestão — redesign de UI/UX

## Overview
Sistema interno de gestão da Footure cobrindo o ciclo de receita das três linhas de negócio (Footlink SaaS, Footure Academy, Consultoria):

**Lead → Pedido de venda → Contrato → Assinatura (Clicksign) → Parcelas (Bling)**

Quatro perfis com visões distintas: **Diretoria** (tudo), **Comercial**, **Jurídico**, **Financeiro**. Tema claro e escuro.

O objetivo é aplicar esta estrutura, UI e experiência ao sistema existente (`footure-os`), **sem reescrever regras de negócio, APIs ou modelos de dados já implementados**.

## About the Design Files
Os arquivos em `prototype/` são **referências de design feitas em HTML** — um protótipo mostrando aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é **recriar estas telas no ambiente atual do `footure-os`** (framework, roteamento, componentes, estado, chamadas de API e convenções já existentes). Os dados do protótipo são fictícios e as integrações (Clicksign, Bling) são simuladas — no sistema real, ligue cada tela às fontes de dados e serviços que já existem.

Para abrir o protótipo: sirva a pasta `prototype/` com qualquer servidor estático (ex.: `npx serve prototype`) e abra `Footure Gestao.dc.html`. Toda a lógica e os dados mock estão no `<script>` no final desse arquivo (classe `Component`, método `renderVals()`), e o layout/estilos estão inline no markup.

## Fidelity
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios, sombras e estados são finais e seguem o **Footlink Design System** (tokens em `prototype/_ds/.../tokens/`). Recrie com fidelidade visual usando os componentes/biblioteca do codebase; se o codebase já tiver tokens equivalentes, mapeie para eles em vez de duplicar.

---

## Estrutura global (app shell)

### AppBar (topo)
- `position: sticky; top: 0; z-index: 1000; height: 60px; background: #5a00ff` (não muda no tema escuro). Padding `0 24px 0 20px`, `gap: 20px`, texto branco.
- **Marca**: ícone `assets/footlink-mark.svg` 28×28 + "footure" (18px/800, tracking −0.01em) sobre "GESTÃO" (10px/700, tracking .12em, opacidade .75).
- **Busca**: `flex: 1 1 0; min-width: 0; max-width: 460px; height: 38px; radius 8px; background rgba(255,255,255,.1)`; ícone MdSearch 18px; placeholder "Busque clientes, pedidos ou contratos..." 14px, opacidade .75, `nowrap + ellipsis`.
- **Seletor de perfil** (protótipo — no sistema real o perfil vem do usuário logado/permissões; pode virar um "ver como" só para admin): pill `padding 3px; radius 20px; bg rgba(255,255,255,.1); border 1px rgba(255,255,255,.2)`. Itens 12px/700, `padding 5px 12px; radius 18px`; ativo = fundo `#fff`, texto `#5a00ff`; inativo = transparente, texto `rgba(255,255,255,.85)`.
- **Botão de tema** e **notificações**: 38×38, radius 8, bg `rgba(255,255,255,.1)` (hover `.2`). Ponto de notificação 8px `#ff5252` com borda 2px `#5a00ff`.
- **Avatar do usuário**: círculo 30px branco, iniciais 12px/800 roxo; nome no `title`.

### Sidebar (navegação por módulo)
- `position: sticky; top: 60px; width: 248px; height: calc(100vh - 60px); background: var(--white); border-right: 1px solid var(--gray5); padding: 20px 0`.
- Seções com rótulo micro (11px/700, uppercase, tracking .06em, `--gray3`, padding `0 24px 6px`), gap entre seções 18px.
- Item: `margin 0 12px; padding 9px 12px; radius 8px; 14px/600`. Ícone em caixa 28×28 radius 8 com cor do módulo, ícone branco 16px.
  - Ativo: bg `var(--nav-active-bg)` (claro ≈ `rgba(90,0,255,.08)`, escuro `rgba(90,0,255,.20)`), texto `--lightPurple1`, `border-left: 3px solid --lightPurple1` (inativo: 3px transparente para não deslocar texto).
  - Hover: `--surface-hover`.
  - Contador à direita: 18px de altura, radius 9, bg `--lightPurple1`, texto branco 10px/800.
- Itens e cores:
  - **Gestão** → Dashboard (`--iconPurple`)
  - **Comercial** → Leads (`--iconBlue`, conta leads abertos), Pedidos de venda (`--iconGreen`, conta pedidos aguardando)
  - **Jurídico** → Contratos (`--iconPurple`, conta contratos não assinados)
  - **Financeiro** → Contratos e parcelas (`--iconYellow`), Inadimplência (`--iconRed`, conta inadimplentes)
- Visibilidade por perfil: Diretoria = todas; Comercial = Comercial; Jurídico = Jurídico; Financeiro = Financeiro. Cada perfil abre em sua "home": Diretoria→Dashboard, Comercial→Leads, Jurídico→Contratos, Financeiro→Contratos e parcelas.
- Rodapé: card "INTEGRAÇÕES" (border 1px `--gray5`, radius 10, padding 14) com status de Clicksign e Bling (ponto 8px `--green2`, nome 13px/600, status 12px `--gray3`, ex.: "há 4 min").

### Área de conteúdo
- `main`: `flex: 1; min-width: 0; padding: 30px`. Telas com `max-width` 1300–1500px.
- **Cabeçalho de página** (padrão em todas as telas): micro-rótulo do módulo (11px/700 uppercase, `--lightPurple1`) → título H1 28px/700 tracking −0.01em `--darkPurple1` → descrição de uma frase 14px `--gray`. Ações à direita, alinhadas na base (`align-items: flex-end`), com wrap.
- Transição entre telas: `fadeInAnim` 0.35s ease (opacity 0→1, translateY 8px→0).
- **Toast** de confirmação: fixo, `bottom 24px`, centralizado, bg `#09001a`, texto branco 14px/600, `padding 12px 18px`, radius 8, sombra `0 4px 16px rgba(0,0,0,.25)`, ícone check `#6fcf97`. Some após 2,6s.

### Padrões reutilizáveis
- **Card**: bg `--white`, border 1px `--gray5`, radius 12, padding 24, sombra `0 2px 8px rgba(0,0,0,.02)` (hover `0 4px 12px rgba(0,0,0,.05)`). Título do card 18px/700 `--darkPurple1`.
- **KPI card**: padding `20px 24px`; rótulo micro `--gray3`; valor 28–30px/800 tracking −0.02em; linha de apoio 13px (delta em verde/vermelho/roxo + texto `--gray3`). Grid `repeat(auto-fit, minmax(220px,1fr))`, gap 20.
- **Tabela**: container card radius 12, sombra `0 4px 15px rgba(0,0,0,.03)`, `overflow: auto` com `min-width` interno (900–1000px). Cabeçalho: 11px/700 uppercase tracking .06em `--gray`, `border-bottom: 2px solid --gray5`. Células `padding 12px 15px`, linhas `border-bottom 1px --gray5`, hover `--surface-hover`, linha inteira clicável. Nome do cliente em `--lightPurple1` 700 + subtítulo 12px `--gray3`.
- **Badge de linha de receita** (componente `Badge` do DS): Footlink = tone `purple`; Academy = tone `latam` (azul); Consultoria = tone `fifa` (laranja). Cores de série em gráficos: Footlink `--lightPurple1` (#5a00ff), Academy `--iconBlue` (#2f80ed), Consultoria `--orange2` (#f2994a).
- **StatusPill** (componente do DS) — mapeamento:
  - Pedido: Rascunho `not_started` · No jurídico `pending` · Aprovado `completed`
  - Contrato: Em geração `not_started` · Em validação `pending` · Aguard. assinatura `in_progress` · Assinado `completed`
  - Parcela: Em aberto `not_started` · Paga `completed` · Vencida `inactive`
  - Contrato financeiro: Em dia `active` · Atrasado `inactive`
  - Dias de atraso: >60 `inactive`, demais `pending`
- **Abas de filtro** (Contratos): botões 38px de altura, `padding 0 16px`, radius 8, 14px/600 + contador 12px/800. Ativo = `--segment-active-bg` / `--segment-active-text`, border transparente; inativo = `--white`, texto `--dark`, border 1px `--lightBorder`.
- **SegmentedToggle** do DS para alternâncias (período, layout do dashboard, Kanban/Tabela, linha de receita, forma de pagamento).
- **Botão voltar**: 38×38, radius 8, border 1px `--gray5`, bg `--white`, ícone MdArrowBack.
- Ícones: Material Design Icons (filled), via `react-icons/md` se o projeto for React.

---

## Screens / Views

### 1. Dashboard (Gestão)
**Propósito**: visão executiva de receita, funil, contratos e recebimentos.
**Cabeçalho**: "Gestão" / "Indicadores do negócio" / "Receita, funil comercial, contratos e recebimentos consolidados de Footlink, Academy e Consultoria." Ações: toggle de período (Mês · Trimestre · 12 meses) e toggle de layout (**Visão geral** · **Fluxo**).
**KPIs (comuns aos dois layouts)**: Receita contratada · 12m; MRR Footlink; Pipeline aberto (soma dos leads abertos + nº de leads); Inadimplência (% + valor vencido em vermelho).

**Layout A — Visão geral**
- Linha 1 (grid `repeat(auto-fit, minmax(min(100%,380px),1fr))`):
  - **Receita mensal**: gráfico de barras agrupadas, 12 meses, realizado (`--lightPurple1`) vs previsto (`--lightPurple3`), barras com `max-width 16px`, radius `4px 4px 0 0`, altura do gráfico 220px, eixo Y à esquerda (11px `--gray3`), legenda no topo à direita.
  - **Receita por linha**: barra empilhada horizontal 12px (radius 6, gap 2px) + lista das 3 linhas (quadrado de cor 10px, nome 700, subtítulo 12px, valor e % à direita).
- Linha 2:
  - **Funil comercial**: 5 etapas (Leads recebidos → Qualificados → Propostas enviadas → Pedidos emitidos → Contratos assinados), barra 8px por etapa com opacidade decrescente, número e % de conversão sobre a etapa anterior.
  - **Contratos em andamento**: lista com Avatar 36px, cliente, nº do contrato · valor, StatusPill; "Ver todos" leva a Contratos; clicar em um item abre Contratos com ele selecionado.
  - **Inadimplência por atraso**: barras verticais por faixa (1–30, 31–60, 61–90, +90 dias) com cores `--orange`, `--orange2`, `--red`, `#b71c1c`; "Detalhar" leva a Inadimplência.

**Layout B — Fluxo**
- **Fluxo de receita**: 5 blocos encadeados (grid 5 colunas, bordas coladas, radius só nas pontas): Leads · Pedidos · Contratos · Assinatura · Parcelas. Cada bloco: número em círculo roxo 22px, rótulo micro, contagem 32px/800, valor 14px/600, subtítulo 12px, barra de progresso 4px proporcional ao valor. Clicar leva ao módulo correspondente.
- **Metas por vendedor**: Avatar 40px + nome + "realizado de meta" + barra 8px (verde ≥75%, roxo ≥55%, laranja abaixo) + % à direita; rodapé com receita por linha.
- **Pontos de atenção**: lista de alertas acionáveis (ícone em caixa 32px com fundo tintado + título 700 + descrição 13px + chevron). Exemplos: maior atraso, assinatura pendente, contrato parado em validação, maior oportunidade do pipeline. Cada um navega para o contexto.

### 2. Leads (Comercial)
**Cabeçalho**: "Comercial" / "Leads" / resumo dinâmico ("N oportunidades abertas · R$ X em pipeline nas três linhas de receita."). Ações: filtro de linha (Todas · Footlink · Academy · Consultoria), toggle **Kanban · Tabela**, botão "Novo lead".
**Kanban**: colunas Novo · Qualificação · Proposta · Negociação · Ganho (pontos de cor `--gray3`, `--iconBlue`, `--orange2`, `--lightPurple1`, `--green2`). Coluna: largura 290px, card branco radius 12; cabeçalho `padding 14px 8px 12px 16px`, título micro + "contagem · total" (nowrap). Cartão do lead: bg `--kanban-card-bg`, border `--kanban-card-border`, radius 10, padding 14, sombra `0 1px 4px rgba(0,0,0,.05)` (hover `0 4px 12px rgba(0,0,0,.08)` + border `--lightPurple8`). Conteúdo: cliente (15px/700 `--kanban-name`), "tipo · origem", Badge da linha, plano (13px `--gray2`), rodapé com valor 16px/800, "Nd na etapa" e Avatar 26px do responsável. Rolagem horizontal. Clique abre a tela **Negócio**.
**Tabela**: colunas Cliente (avatar + nome + tipo · contato) · Produto (badge + plano) · Etapa · Valor ⇅ · Responsável · Origem · chevron.

### 3. Pedidos de venda (Comercial)
**Cabeçalho**: "Pedidos de venda" / "Pedidos aprovados seguem automaticamente para geração de contrato no jurídico." Ação: "Novo pedido".
**Tabela**: Pedido (nº PV-AAAA-NNN + data dd/mm/aa) · Cliente (nome + tipo · vendedor) · Produto · Plano (badge + plano) · Valor · Pagamento ("Boleto · 12x" / "PIX · à vista") · Status (StatusPill). Clique → Negócio.

### 4. Novo pedido de venda (Comercial)
Layout em 2 colunas (`minmax(0,1.7fr) minmax(300px,1fr)`), formulário à esquerda, resumo fixo (`sticky; top: 90px`) à direita.
- **Cliente**: Lead de origem (Select — ao escolher, preenche razão social, signatário, linha, plano, valor, parcelas e forma) · Perfil (Clube, Agente, Aluno, Empresa) · Razão social · CNPJ/CPF · Responsável pela assinatura · E-mail do signatário.
- **Produto**: toggle de linha (Footlink · Academy · Consultoria) que troca as opções de Plano:
  - Footlink: Scout Starter, Scout Basic, Scout Essential, Scout Elite, Multi-Club, Scout Prime (agente)
  - Academy: Scouting Profissional, Análise de Mercado, Análise de Desempenho, Turma in company
  - Consultoria: Estruturação de scouting, Diagnóstico de mercado, Análise de elenco
  - \+ Licenças/vagas · Vigência (meses) · Valor total (R$)
- **Pagamento**: toggle Boleto · PIX · Cartão; Parcelas (À vista, 2x, 3x, 4x, 6x, 10x, 12x); 1º vencimento.
- Campos em grid `repeat(auto-fit, minmax(220px,1fr))`, gap 16; usar `Input` e `Select` do DS (rótulo micro acima).
- **Resumo** (recalculado em tempo real): cliente, produto, valor total, forma, parcela ("12x de R$ 20.000"), vigência; "Próximas etapas" (1. Jurídico gera contrato do modelo X · 2. Envio via Clicksign · 3. Parcelas criadas no Bling após assinatura). Botões: **Enviar ao jurídico** (primário) e **Salvar rascunho** (branco).
- O modelo de contrato é derivado: Footlink + Agente → "Footlink Agente"; Footlink + outros → "Footlink Clube"; Academy; Consultoria.

### 5. Negócio (visão ponta-a-ponta de um cliente)
Acessada ao clicar em qualquer lead, pedido, contrato ou cliente. É a tela-chave da experiência.
- **Cabeçalho**: voltar · Avatar 52px · nome (28px/700) + Badge da linha · "tipo • plano • valor" · botões "Editar dados" e **ação contextual da próxima etapa** (primário):
  - lead → "Converter em pedido"
  - pedido rascunho → "Enviar ao jurídico"
  - contrato em geração → "Gerar contrato"
  - em validação → "Aprovar e enviar à Clicksign"
  - aguardando assinatura → (no protótipo) "Simular assinatura concluída" — no real, isso chega por webhook da Clicksign
  - assinado → sem botão
- **Stepper** de 5 etapas (card, grid 5 colunas): círculo 32px — concluída = bg `--lightPurple1` + "✓" branco; atual = bg `--lightPurple4`, borda 2px `--lightPurple1`, número roxo; futura = bg branco, borda 1.5px `--gray5`, número `--gray3`. Conector 2px (roxo se concluído, `--gray5` se não). Título 700 + subtítulo 12px `--gray3` (ex.: "PV-2026-103", "Clicksign · 1/3", "5/12 pagas").
- **4 cards** (grid `auto-fit minmax(320px,1fr)`), cada um com ícone de módulo em caixa 30px:
  - **Lead**: Contato, Perfil, Origem, Responsável, Valor estimado (linhas chave/valor: rótulo micro à esquerda, valor 600 à direita, divisor `--gray5`).
  - **Pedido de venda**: Número, Emissão, Plano, Pagamento, Parcela + StatusPill. Vazio: "Nenhum pedido emitido / Converta o lead para gerar o pedido de venda."
  - **Contrato**: nº, modelo, lista de signatários Clicksign (Footure · Diretor, Contratante, Testemunha) com ícone 22px — assinado (verde, check, "Assinou dd/mm"), pendente (`--orange3`/`#ce9232`, relógio), não enviado (cinza). Vazio: "Contrato ainda não gerado / O jurídico recebe o pedido após o envio pelo comercial."
  - **Parcelas**: "Bling · X de N pagas", barra de progresso 6px verde, lista rolável (máx. 300px): nº/total · vencimento · valor · StatusPill. Vazio: "Parcelas não geradas / As cobranças são criadas no Bling após a assinatura do contrato."

### 6. Contratos (Jurídico)
**Cabeçalho**: "Jurídico" / "Contratos" / "Geração a partir do pedido de venda, validação jurídica e assinatura eletrônica via Clicksign."
- Abas: Todos · Em geração · Em validação · Aguardando assinatura · Assinados (com contadores).
- Layout mestre-detalhe: grid `repeat(auto-fit, minmax(min(100%,440px),1fr))` (empilha em telas estreitas).
- **Lista**: Contrato (cliente + nº · data) · Produto (badge) · Valor · Status. Linha selecionada: bg `--lightPurple4` + `border-left 3px --lightPurple1`.
- **Painel de detalhe** (sticky top 90px), em seções separadas por divisores:
  1. nº + StatusPill, cliente 20px/700, modelo do contrato, "Pedido PV-… · Valor R$ …"
  2. **Validação jurídica** — checklist (checkbox 20px radius 6; marcado = bg `--green1` + check branco): Dados cadastrais e CNPJ conferidos · Valores e parcelas conforme pedido · Cláusulas padrão do modelo mantidas · Anexo de plano e licenças incluído
  3. **Assinaturas · Clicksign** "X de 3" + signatários (mesmo padrão da tela Negócio)
  4. Ações: primária contextual ("Gerar contrato do modelo" / "Aprovar e enviar à Clicksign" / "Reenviar lembrete aos signatários") + "Ver negócio" e "Baixar PDF".

### 7. Contratos e parcelas (Financeiro)
**Cabeçalho**: "Financeiro" / "Contratos e parcelas" / "Carteira de contratos assinados e cobranças sincronizadas com o Bling." Ações: indicador "Bling · há N min" (ponto verde) + botão "Sincronizar" (secondary) → toast "Bling sincronizado · N baixas de pagamento importadas".
- KPIs: Carteira ativa · A receber (mês) · Recebido (mês, verde, % do previsto) · Vencido (vermelho).
- **Carteira de contratos** (tabela): Cliente (nome + nº contrato) · Produto · Valor · Parcelas pagas (barra 6px verde + "5/12") · Próx. venc. · Situação (Em dia / Atrasado). Clique → Negócio.
- **Parcelas do mês** (tabela): Cliente · Parcela (n/N) · Vencimento · Valor · Forma · ID Bling · Status.

### 8. Inadimplência (Financeiro)
**Cabeçalho**: "Inadimplência" / "Parcelas vencidas, faixa de atraso e etapa da régua de cobrança de cada cliente." Ações: "Exportar" e "Notificar todos" (primário).
- Linha superior (grid auto-fit 400px): 4 KPIs em 2×2 (Total vencido, Taxa de inadimplência + meta, Clientes inadimplentes, Recuperado no mês) + card "Valor vencido por faixa de atraso" com barras horizontais 22px (rótulo 76px · barra flex com `min-width 80px` · valor · nº de clientes).
- **Tabela**: Cliente (avatar + nome + linha · contrato) · Em atraso (valor em `--red` 700) · Vencido desde · Dias ↓ (StatusPill) · Régua de cobrança · Ações ("Notificar" secondary pequeno → vira "Notificado"; "Renegociar" branco pequeno).
- Régua de cobrança (etapas sugeridas): D+3 e-mail automático → D+15 WhatsApp → D+30 contato do financeiro → D+60 notificação extrajudicial.

---

## Interactions & Behavior
- Navegação: sidebar troca de tela; listas abrem **Negócio**; "voltar" retorna à tela de origem (guardar a tela anterior).
- Avanço de etapa (Negócio e Contratos) muda o status, atualiza contadores da sidebar e do dashboard e mostra toast:
  - "Pedido de venda criado para {cliente}"
  - "Pedido enviado ao jurídico"
  - "Contrato {nº} gerado a partir do modelo"
  - "Contrato enviado para assinatura via Clicksign"
  - "Assinatura concluída · N parcelas criadas no Bling"
- Tema: botão sol/lua alterna `body[data-theme="dark"]`, persistido em `localStorage` (`footlink_theme`). Todas as cores vêm de variáveis CSS, então o dark mode é automático. A AppBar permanece `#5a00ff`.
- Hover: linhas/itens → `--surface-hover`; cards → sombra mais funda; botões coloridos → sombra `0 4px 12px rgba(0,0,0,.05)`. Foco: anel `0 0 0 3px rgba(90,0,255,.12)`, nunca outline.
- Motion: `ease` 200ms em botões/hover, 300ms em cards/inputs, 350ms na entrada de tela. Nada de bounce/scale.
- Responsivo: grids com `auto-fit/minmax(min(100%,Npx),1fr)` empilham em telas estreitas; tabelas rolam horizontalmente; textos da AppBar usam ellipsis.
- Estados vazios: duas linhas — o problema e como resolver (exemplos na tela Negócio).

## Integrações (no sistema real)
- **Clicksign**: "Aprovar e enviar à Clicksign" cria o envelope com os 3 signatários; status por signatário e conclusão chegam por webhook; "Reenviar lembrete" usa a API de notificação.
- **Bling**: ao concluir a assinatura, gerar as contas a receber/parcelas no Bling; "Sincronizar" importa baixas de pagamento; exibir o ID Bling de cada parcela e o horário da última sincronização na sidebar e no Financeiro.

## State Management
- `perfil` do usuário (vem da autenticação/permissões) → define módulos visíveis e tela inicial.
- `theme` (`light`/`dark`, persistido).
- Entidade central "negócio" (ou relação lead → pedido → contrato → parcelas) com:
  - `stage`: 0 lead · 1 pedido · 2 contrato (geração/validação) · 3 assinatura · 4 ativo/cobrança
  - `etapa` do lead (Novo, Qualificação, Proposta, Negociação), `pv` status, `ct` status (`geracao`, `validacao`, `assinatura`, `assinado`), parcelas com status, dias de atraso, etapa da régua.
- Filtros de UI: período e layout do dashboard, visão Kanban/Tabela, filtro de linha, aba de contratos, contrato selecionado.
- Contadores da sidebar e KPIs são derivados desses dados.

## Design Tokens (Footlink Design System)
Arquivos completos em `prototype/_ds/footlink-design-system-5f1c43a0-720b-448a-9b06-792e114cf557/tokens/`. Principais:
- **Marca**: `--lightPurple1 #5a00ff`, `--lightPurple3 #deccff`, `--lightPurple4 #eee5ff`, `--lightPurple8 #ceb3ff`, `--darkPurple1 #09001a` (vira `#fff` no dark — usado como cor de texto)
- **Neutros (claro)**: `--black #000`, `--dark #4a4a4a`, `--gray #62747c`, `--gray2 #4f4f4f`, `--gray3 #828282`, `--gray5 #e0e0e0`, `--lightBorder #bdbdbd`, `--light #f5f5f5` (página), `--white #fff` (superfície), `--surface-hover #f9f9f9`
- **Dark**: página `#151521`, superfície `#1e1e2d`, bordas `#2b2b40`, `--lightPurple4 #212e48`, card kanban `#252538`, nome kanban `#a06bff`
- **Semânticas**: `--red #eb5757`, `--danger #ff5252`, `--dangerBg #ffdfdf`, `--green1 #219653`, `--green2 #27ae60`, `--green5 #bde6ce`, `--orange #f5a623`, `--orange2 #f2994a`, `--orange3 #ffeacc`, `--info #29b6f6`
- **Módulos**: `--iconPurple #5a00ff`, `--iconBlue #2f80ed`, `--iconGreen #219653`, `--iconYellow #f2994a`, `--iconRed #eb5757`
- **Tipografia**: Barlow (100–900, Google Fonts) apenas. H1 28px/700 −0.01em; título de card 18px/700; valores KPI 28–32px/800 −0.02em; corpo 14px/400 lh 1.5; micro-rótulo 11px/700 uppercase +0.06em; legendas 12–13px.
- **Espaço**: gutter 30px, padding de card 24px, gaps 20/16/14/10/8; células `12px 15px`; AppBar 60px; sidebar 248px; coluna kanban 290px.
- **Raios**: 6 (checkbox), 8 (botões, inputs, nav), 10 (cards kanban, caixas de ícone), 12 (cards, tabelas), 20 (pills), 50% (avatares).
- **Sombras**: card `0 2px 8px rgba(0,0,0,.02)` · hover `0 4px 12px rgba(0,0,0,.05)` · tabela `0 4px 15px rgba(0,0,0,.03)` · kanban `0 1px 4px rgba(0,0,0,.05)` · toast `0 4px 16px rgba(0,0,0,.25)` · foco `0 0 0 3px rgba(90,0,255,.12)`.

## Assets
- `prototype/assets/footlink-mark.svg` — marca usada na AppBar (substituir pela marca Footure oficial do codebase, se houver).
- Ícones: Material Design Icons (paths inline no protótipo: dashboard, people, receipt, gavel, attach_money, warning, search, dark_mode, light_mode, chevron_right, check_circle, check, schedule, notifications, arrow_back, description).
- Avatares usam iniciais (componente `Avatar` do DS). Sem fotos.

## Files
- `prototype/Footure Gestao.dc.html` — protótipo completo (markup + lógica + dados mock no `<script>` final)
- `prototype/support.js` — runtime para abrir o protótipo no navegador (não portar)
- `prototype/_ds/…/` — Footlink Design System: tokens CSS + bundle dos componentes (Button, Badge, StatusPill, Avatar, Input, Select, SegmentedToggle)
- `PROMPT_CLAUDE_CODE.md` — prompt sugerido para iniciar a implementação no Claude Code
