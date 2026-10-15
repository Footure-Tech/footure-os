// Porte de _docs/referencia-skill/scripts/gerar_contrato.js para TypeScript.
//
// Texto das cláusulas mantido intacto (validado contra os 4 contratos-modelo
// em _docs/contratos-modelo/, ver scripts/test-geracao.ts) — só duas partes
// são lógica NOVA, não simples parametrização (ver PROMPT.md seção 6.4):
//
// 1. Bloco de assinaturas com N representantes/testemunhas por lado. Nenhum
//    dos 4 contratos reais mostra nome individual de representante — sempre
//    só a razão social (CONTRATANTE) e "FOOTURE... LTDA" (CONTRATADA). Por
//    isso: quando representantesContratante/representantesFooture vier
//    vazio, o bloco cai exatamente no padrão histórico (nome da empresa); só
//    quando a lista é preenchida (capacidade nova, pensada pro envelope da
//    Fase 3/Clicksign) é que aparece um bloco por pessoa.
// 2. Cláusula Sétima/Oitava para à-vista COM API discriminada — não existe
//    em nenhum contrato-modelo (só há parcelado+API, o caso Corinthians).
//    Texto abaixo é por analogia ao padrão Corinthians, adaptado pra parcela
//    única — precisa de validação jurídica antes de produção.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
  Header,
  Footer,
  ImageRun,
  PageBreak,
  TableLayoutType,
} from "docx";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Parcela } from "./parcelas";

export interface Signatario {
  nomeCompleto: string;
  email: string;
  cpf: string;
}

export interface DadosContrato {
  perfil: "clube" | "agente";
  /** Linhagem enxuta (padrão, os dois perfis) vs robusta (SLA 98%/LGPD reforçada) — decisão
   * comercial por cliente, não decorre mais do perfil (ver _skill/references/clausulas.md). */
  robusta: boolean;
  cliente: string;
  cnpj: string;
  endereco: string;
  representantesContratante: Signatario[];
  testemunhasContratante: Signatario[];
  representantesFooture: { nome: string }[];
  testemunhasFooture: Signatario[];
  /** Já vem com o prefixo "Scout" aplicado (resolvido via lib/plans/normalize.ts). */
  plano: string;
  api: boolean;
  /** Só relevante quando `api` — 'combinado' usa o texto/total já somado (igual ao caso sem
   * API); 'distintos' discrimina parcela da API e do software (padrão Corinthians). */
  apiModelo?: "combinado" | "distintos";
  pagamento: "parcelado" | "avista";
  /** Só relevante quando pagamento === "parcelado" — boleto (padrão) ou pix (bloco bancário). */
  metodo?: "boleto" | "pix";
  total: string;
  mensal: string;
  mensalApi?: string;
  mensalSoftware?: string;
  licAdicional: string;
  diaVenc?: string;
  primeiroVenc?: string;
  vencAvista?: string;
  /** Só relevante quando pagamento === "parcelado" — era fixo em 12. */
  numeroParcelas?: number;
  vigIni: string;
  vigFim: string;
  divulgacao: "nenhuma" | "simples" | "obrigacao";
  /** Só relevante quando divulgacao === "obrigacao" — narrativa, não entra em cálculo
   * (o valor já descontado é o que o vendedor informa em total/mensal). */
  percentualDesconto?: number;
  postDivulgacao?: string;
  foro: string;
  multaTexto: string;
  features: Array<[string, string]>;
  parcelas: Parcela[];
  dataGeracao: Date;
}

const ASSET_LOGO_FOOTLINK = path.join(process.cwd(), "_docs/referencia-skill/assets/footlink-logo.png");
const ASSET_LOGO_FOOTURE = path.join(process.cwd(), "_docs/referencia-skill/assets/footure-logo.png");

// ---------- helpers de parágrafo ----------
const R = (t: string) => new TextRun({ text: t, size: 22 });
const B = (t: string) => new TextRun({ text: t, bold: true, size: 22 });
const P = (children: TextRun[] | string) =>
  new Paragraph({
    spacing: { after: 120 },
    alignment: AlignmentType.JUSTIFIED,
    children: Array.isArray(children) ? children : [R(children)],
  });
const H = (t: string) =>
  new Paragraph({
    spacing: { before: 200, after: 120 },
    alignment: AlignmentType.CENTER,
    border: {
      top: { style: BorderStyle.SINGLE, size: 6 },
      bottom: { style: BorderStyle.SINGLE, size: 6 },
      left: { style: BorderStyle.SINGLE, size: 6 },
      right: { style: BorderStyle.SINGLE, size: 6 },
    },
    children: [new TextRun({ text: t, bold: true, size: 22 })],
  });

// ---------- cabeçalho / rodapé ----------
// Footure (contratada) à esquerda, Footlink (produto) à direita, entre duas
// linhas. Tabela de 2 células (e não tab stop) porque renderiza igual no Word,
// na conversão da Clicksign e em visualizadores simples.
const LARGURA_UTIL = 11906 - 2 * 1134;
const LINHA_CABECALHO = { style: BorderStyle.SINGLE, size: 6, color: "5B4FC4" } as const;
const SEM_LINHA = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
function logoOuTexto(arquivo: string, transformation: { width: number; height: number }, texto: string) {
  if (existsSync(arquivo)) return new ImageRun({ type: "png", data: readFileSync(arquivo), transformation });
  return new TextRun({ text: texto, bold: true, size: 28, color: "5B4FC4" });
}
function celulaLogo(logo: ImageRun | TextRun, alignment: (typeof AlignmentType)[keyof typeof AlignmentType]) {
  return new TableCell({
    width: { size: LARGURA_UTIL / 2, type: WidthType.DXA },
    margins: { top: 120, bottom: 120, left: 0, right: 0 },
    // Borda da célula prevalece sobre a da tabela no Word — as linhas ficam aqui.
    borders: { top: LINHA_CABECALHO, bottom: LINHA_CABECALHO, left: SEM_LINHA, right: SEM_LINHA },
    children: [new Paragraph({ alignment, children: [logo] })],
  });
}
function buildHeader() {
  return new Header({
    children: [
      new Table({
        width: { size: LARGURA_UTIL, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: [LARGURA_UTIL / 2, LARGURA_UTIL / 2],
        borders: { top: LINHA_CABECALHO, bottom: LINHA_CABECALHO, left: SEM_LINHA, right: SEM_LINHA, insideHorizontal: SEM_LINHA, insideVertical: SEM_LINHA },
        rows: [
          new TableRow({
            children: [
              celulaLogo(logoOuTexto(ASSET_LOGO_FOOTURE, { width: 104, height: 40 }, "footure"), AlignmentType.LEFT),
              celulaLogo(logoOuTexto(ASSET_LOGO_FOOTLINK, { width: 106, height: 40 }, "footlink"), AlignmentType.RIGHT),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 120 }, children: [] }),
    ],
  });
}
function buildFooter(D: DadosContrato) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "5B4FC4" } },
        children: [
          new TextRun({
            text: `Instrumento Particular de Uso do Software Footlink  ·  ${D.cliente}  ·  Início da vigência: ${D.vigIni || "—"}`,
            size: 14,
            color: "666666",
          }),
        ],
      }),
    ],
  });
}

// ---------- tabelas ----------
function featTable(planoLabel: string, features: Array<[string, string]>) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 7200, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "D9D9F3" },
          children: [P([B(`PLANO FOOTLINK ${planoLabel.toUpperCase()} - FEATURES`)])],
        }),
        new TableCell({
          width: { size: 2000, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "D9D9F3" },
          children: [P([B("PLANO")])],
        }),
      ],
    }),
  ];
  for (const [f, v] of features) {
    if (f === "#") {
      // Linha de seção (tabela de agente, agrupada em Capacidade/Minha Agência/Base de
      // Atletas/Mercado) — subcabeçalho ocupando as duas colunas.
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              width: { size: 9200, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: "ECECF7" },
              children: [P([B(v)])],
            }),
          ],
        }),
      );
      continue;
    }
    rows.push(
      new TableRow({
        children: [
          new TableCell({ width: { size: 7200, type: WidthType.DXA }, children: [P(f)] }),
          new TableCell({
            width: { size: 2000, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "E2EFDA" },
            children: [P(v)],
          }),
        ],
      }),
    );
  }
  return new Table({ columnWidths: [7200, 2000], width: { size: 9200, type: WidthType.DXA }, rows });
}
function parcTable(parcelas: Parcela[]) {
  const head = ["Parcela", "Mês de Vigência", "Período", "Vencimento da Parcela"];
  const w = [1400, 2200, 3400, 2200];
  const rows = [
    new TableRow({
      tableHeader: true,
      children: head.map(
        (h, i) =>
          new TableCell({
            width: { size: w[i], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
            children: [P([B(h)])],
          }),
      ),
    }),
  ];
  for (const parcela of parcelas) {
    const celulas = [parcela.numero, parcela.mesVigencia, parcela.periodo, parcela.vencimento];
    rows.push(
      new TableRow({
        children: celulas.map(
          (c, i) => new TableCell({ width: { size: w[i], type: WidthType.DXA }, children: [P(String(c))] }),
        ),
      }),
    );
  }
  return new Table({ columnWidths: w, width: { size: 9200, type: WidthType.DXA }, rows });
}

// ---------- bloco de dados bancários (Cláusula Oitava, PIX) ----------
function pixBankBlock(): Paragraph[] {
  const linhas = [
    "FOOTURE PRODUTORA DE CONTEUDO, SOFTWARE E SERVICOS LTDA",
    "(CNPJ: 32.527.841/0001-48)",
    "BANCO: INTER S.A. 077",
    "AGÊNCIA: 0001",
    "CONTA CORRENTE: 2463249 – 0",
    "PIX: CNPJ32527841000148",
  ];
  return linhas.map((l) => new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.LEFT, children: [B(l)] }));
}

// ---------- divulgação "obrigação de fazer" = divulgação mútua (§§ da Cláusula Sétima) ----------
// Revisão jurídica (set/2026): o desconto é um campo opcional dentro dessa mesma
// opção, não um requisito — por isso o texto não amarra mais a divulgação ao
// "preço"/"obrigação de fazer" (se o vendedor não preencher desconto, a cláusula
// sai igual, só sem desconto real aplicado). O desconto em si (5% parcela <
// R$1.000, 10% se ≥, quando combinado) já está refletido em D.total/D.mensal;
// não recalcula nada aqui, é só narrativa/auditoria.
function blocoDivulgacaoObrigacao(D: DadosContrato, proxParagrafo: () => string): Paragraph[] {
  const post = D.postDivulgacao || "uma imagem promocional com texto de divulgação da parceria a ser aprovado entre as partes";
  return [
    P([
      B(proxParagrafo()),
      R(
        `As partes ajustam que, em data a ser definida entre os departamentos de comunicação e marketing de ambas, o CONTRATANTE irá publicar nas suas redes sociais (Instagram, twitter, facebook e linkedin), marcando “@FootureFC”, “@footlink.app” e “@Footlink_”, ${post}.`,
      ),
    ]),
    P([
      B(proxParagrafo()),
      R(
        "Da mesma forma, o CONTRATANTE autoriza à CONTRATADA a publicação da imagem e texto em seu site e nas redes sociais (Instagram, twitter, facebook e linkedin) @FootureFC, @footlink.app, @Footlink.",
      ),
    ]),
  ];
}

// ---------- numeração dinâmica das cláusulas ----------
// A divulgação "simples" é uma cláusula standalone (Décima) que desloca vigência/
// rescisão/confidencialidade/exclusividade/disposições/foro — as demais (Primeira a
// Nona) são sempre fixas. "obrigacao" não desloca nada (entra como §§ na Sétima).
const ORD = [
  "",
  "PRIMEIRA",
  "SEGUNDA",
  "TERCEIRA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SÉTIMA",
  "OITAVA",
  "NONA",
  "DÉCIMA",
  "DÉCIMA PRIMEIRA",
  "DÉCIMA SEGUNDA",
  "DÉCIMA TERCEIRA",
  "DÉCIMA QUARTA",
  "DÉCIMA QUINTA",
  "DÉCIMA SEXTA",
  "DÉCIMA SÉTIMA",
  "DÉCIMA OITAVA",
  "DÉCIMA NONA",
  "VIGÉSIMA",
  "VIGÉSIMA PRIMEIRA",
];
const CL = (n: number) => `CLÁUSULA ${ORD[n]}: `;

// ---------- bloco LGPD reforçado (clube) ----------
function lgpdReforcada(): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(
    P([
      B("Parágrafo 5º: "),
      R(
        "Em conformidade com o objeto do Contrato, a CONTRATADA poderá ter acesso a dados que identifiquem ou permitam a identificação de pessoas naturais (“Dados Pessoais”) e que sejam enviados pela CONTRATANTE, coletados ou de qualquer outra forma tratados por conta e ordem desta última. A CONTRATANTE e a CONTRATADA reconhecem reciprocamente que atuam respectivamente como CONTROLADORA e OPERADORA no tratamento de Dados Pessoais que possa estar relacionado ao objeto do Contrato:",
      ),
    ]),
  );
  const al: [string, string][] = [
    [
      "a)",
      "A CONTRATADA declara conhecer e se compromete a cumprir todos os princípios e regras da Lei 13.709 de 2018 (“LGPD”), suas alterações e regulamentos subsequentes que disponham sobre privacidade e proteção de dados pessoais no Brasil que venham a ser editados pela Autoridade Nacional de Proteção de Dados Pessoais (“ANPD”).",
    ],
    [
      "b)",
      "Obriga-se a CONTRATADA a manter os dados pessoais confidenciais, assegurando que o acesso seja estritamente limitado àqueles indivíduos que precisam acessá-lo.",
    ],
    [
      "c)",
      "A CONTRATADA deve manter o registro de todas as operações de tratamento de Dados Pessoais, atendendo o exigido pela legislação e pela regulamentação vigente.",
    ],
    [
      "d)",
      "A CONTRATADA obriga-se a utilizar os dados pessoais exclusivamente para as finalidades previstas no objeto do Contrato, nos termos das instruções emitidas pela CONTRATANTE, sendo vedado o compartilhamento com terceiros, mesmo que de forma anonimizada, salvo mediante autorização prévia, expressa e por escrito da CONTRATANTE, controladora dos dados pessoais.",
    ],
    [
      "e)",
      "Caso a CONTRATADA seja obrigada a transferir ou divulgar qualquer Dado Pessoal tratado em nome da CONTRATANTE em razão de ordem administrativa ou judicial, deverá informar a CONTRATANTE em até 24 (vinte e quatro) horas, comprometendo-se as Partes a cooperar para limitar a extensão de tal transferência ou divulgação.",
    ],
    [
      "f)",
      "A CONTRATADA apenas poderá realizar a transferência internacional dos Dados Pessoais quando o compartilhamento for necessário para atender as finalidades legítimas que justificaram o compartilhamento e desde que em acordo com as exigências legais sobre proteção de dados pessoais.",
    ],
    [
      "g)",
      "A CONTRATADA garante à CONTRATANTE que, após atingida a finalidade que fundamentou o tratamento dos Dados Pessoais, estes serão descartados, exceto quando a retenção for necessária para o cumprimento de obrigação legal ou regulatória.",
    ],
    [
      "h)",
      "A CONTRATADA reconhece que deve cooperar com a CONTRATANTE sempre que necessário para viabilizar o exercício dos direitos de titulares previstos na legislação sobre proteção de dados pessoais.",
    ],
    [
      "i)",
      "A CONTRATADA obriga-se a implementar medidas técnicas e de segurança para resguardar o acesso aos Dados Pessoais, responsabilizando-se por todos os danos eventualmente causados em virtude do tratamento, ressarcindo integralmente a CONTRATANTE por quaisquer prejuízos e/ou penalidades resultantes. Obriga-se ainda a demonstrar conformidade à legislação, autorizando a CONTRATANTE a realizar auditorias mediante prévia e expressa autorização.",
    ],
    [
      "j)",
      "Na hipótese de questionamento à CONTRATANTE por autoridades públicas ou ação judicial relacionada à proteção de dados por violação causada culposa ou dolosamente pela CONTRATADA, esta assumirá por sua conta a defesa, mantendo a CONTRATANTE indene quanto a custas, sanções e honorários advocatícios.",
    ],
    [
      "k)",
      "A CONTRATADA obriga-se a comunicar à CONTRATANTE quaisquer Incidentes de segurança de Dados Pessoais, potenciais ou efetivos, em até 48 (quarenta e oito) horas após a ocorrência, colaborando com informações e medidas para mitigar os prejuízos.",
    ],
    [
      "l)",
      "A CONTRATADA entende e concorda que os serviços objeto do Contrato envolvem o tratamento de dados considerados Dados Pessoais sensíveis, devendo tratá-los conforme as instruções da CONTRATANTE e em estrita conformidade às exigências legais, garantindo a segurança adequada.",
    ],
    [
      "m)",
      "A CONTRATADA entende e concorda que os serviços podem envolver o tratamento de Dados Pessoais de crianças e adolescentes, devendo tratá-los em estrita conformidade às exigências legais e garantindo a observância do melhor interesse da criança e do adolescente.",
    ],
    [
      "n)",
      "A CONTRATADA garante que apenas realizará a coleta de Dados Pessoais de crianças e adolescentes em razão da execução deste instrumento, mediante o consentimento prévio, expresso e específico dos pais e/ou responsável legal, nos termos da LGPD, se a extração de dados for de fonte privada.",
    ],
    [
      "o)",
      "Considerando que o objeto do Contrato inclui a provisão de sistemas e/ou infraestrutura de tecnologia da informação (a “Plataforma”), que pode operacionalizar o tratamento de Dados Pessoais, a CONTRATADA garante que: (i) as Plataformas estão adequadas à regulamentação, melhores práticas e leis de proteção de dados, em especial a LGPD; (ii) estão em conformidade com as normas e políticas da CONTRATANTE em matéria de proteção de dados e segurança da informação; (iii) têm o dever de garantir a segurança e a adequada gestão dos Dados Pessoais; e (iv) devem possibilitar à CONTRATANTE o exercício dos direitos dos titulares previstos na legislação.",
    ],
  ];
  for (const [a, t] of al) {
    out.push(
      new Paragraph({
        spacing: { after: 100 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 360 },
        children: [new TextRun({ text: a + " ", bold: true, size: 22 }), R(t)],
      }),
    );
  }
  return out;
}

// ---------- preâmbulo: representante(s) do CONTRATANTE ----------
// Nenhum dos 4 contratos-modelo lista representante na maioria dos casos
// (fica vazio); ELENKO é o único com N>1 e usa o padrão
// "por {nome} (CPF nº {cpf}) e {nome2} (CPF nº {cpf2})" — replicado abaixo
// generalizado para N pessoas (extrapolação do único caso real disponível).
function textoRepresentantesContratante(representantes: Signatario[]): string {
  if (representantes.length === 0) return "";
  const nomes = representantes.map((r) => `${r.nomeCompleto}, CPF nº ${r.cpf}`);
  if (nomes.length === 1) return `, por ${nomes[0]}`;
  return `, por ${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

// ---------- bloco de assinaturas (página própria) ----------
const MESES_MINUSCULO = [
  "",
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const FEMININO_1_10 = ["", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

function formatarLocalEData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = MESES_MINUSCULO[data.getMonth() + 1];
  return `Porto Alegre, ${dia} de ${mes} de ${data.getFullYear()}.`;
}

function blocoAssinatura(nome: string, papel: string, before: number) {
  const linha = "______________________________________";
  return [
    new Paragraph({
      spacing: { before },
      alignment: AlignmentType.CENTER,
      keepNext: true,
      keepLines: true,
      children: [R(linha)],
    }),
    new Paragraph({
      spacing: { after: 0 },
      alignment: AlignmentType.CENTER,
      keepNext: true,
      keepLines: true,
      children: [B(nome)],
    }),
    new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.CENTER, keepLines: true, children: [R(papel)] }),
  ];
}

function blocosParte(nomeEmpresa: string, representantes: { nome: string }[], papel: string, before: number) {
  // Sem representantes cadastrados: cai no padrão histórico dos 4 contratos
  // reais (só a razão social assina, nenhum nome individual). Com
  // representantes: um bloco por pessoa (necessário pro envelope da Fase 3).
  if (representantes.length === 0) return blocoAssinatura(nomeEmpresa, papel, before);
  return representantes.flatMap((r, i) => blocoAssinatura(r.nome, papel, i === 0 ? before : 720));
}

function blocoAssinaturas(D: DadosContrato): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const linhaT = "________________________________";

  const testemunhas = [...D.testemunhasContratante, ...D.testemunhasFooture];
  const qtdTestemunhas = Math.max(testemunhas.length, 2); // nunca menos que o padrão histórico
  const qtdTexto = FEMININO_1_10[qtdTestemunhas] ?? String(qtdTestemunhas);

  out.push(new Paragraph({ children: [new PageBreak()] }));
  out.push(
    new Paragraph({
      spacing: { after: 360 },
      alignment: AlignmentType.JUSTIFIED,
      children: [
        R(
          `E, por assim se acharem justas e contratadas, as partes assinam o presente Contrato, na presença de ${qtdTexto} testemunha${qtdTestemunhas === 1 ? "" : "s"}, reconhecendo a validade das assinaturas digital e eletrônica, inclusive aquelas que não utilizem certificados ou utilizem certificados não emitidos pela ICP – Brasil, de modo que o presente documento poderá ser assinado por quaisquer destes meios, sendo considerados, desde já, verdadeiros, válidos e eficazes para todos os efeitos, na forma preconizada pela Medida Provisória n.º 2.200-2/2001, em vigor no Brasil.`,
        ),
      ],
    }),
  );
  out.push(
    new Paragraph({
      spacing: { before: 120, after: 120 },
      alignment: AlignmentType.RIGHT,
      children: [R(formatarLocalEData(D.dataGeracao))],
    }),
  );

  out.push(
    ...blocosParte(
      D.cliente,
      D.representantesContratante.map((r) => ({ nome: r.nomeCompleto })),
      "CONTRATANTE",
      480,
    ),
  );
  out.push(
    ...blocosParte(
      "FOOTURE PRODUTORA DE CONTEÚDO, SOFTWARE E SERVIÇOS LTDA",
      D.representantesFooture,
      "CONTRATADA",
      720,
    ),
  );

  out.push(new Paragraph({ spacing: { before: 720, after: 160 }, keepNext: true, children: [B("Testemunhas:")] }));
  const celula = (nome?: string, cpf?: string) =>
    new TableCell({
      width: { size: 4600, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      margins: { right: 400 },
      children: [
        new Paragraph({ spacing: { before: 240, after: 0 }, children: [R(linhaT)] }),
        new Paragraph({ spacing: { after: 0 }, children: [R(`Nome: ${nome ?? ""}`)] }),
        new Paragraph({ spacing: { after: 0 }, children: [R(`CPF: ${cpf ?? ""}`)] }),
      ],
    });

  // Preenche pares de linhas com no mínimo 2 células em branco (padrão
  // histórico) ou uma célula por testemunha cadastrada, o que for maior.
  const totalCelulas = Math.max(testemunhas.length, 2);
  const linhas: TableRow[] = [];
  for (let i = 0; i < totalCelulas; i += 2) {
    const t1 = testemunhas[i];
    const t2 = testemunhas[i + 1];
    linhas.push(
      new TableRow({
        children: [celula(t1?.nomeCompleto, t1?.cpf), celula(t2?.nomeCompleto, t2?.cpf)],
      }),
    );
  }
  out.push(
    new Table({
      columnWidths: [4600, 4600],
      width: { size: 9200, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: linhas,
    }),
  );
  return out;
}

// ---------- montagem principal ----------
export function gerarContrato(D: DadosContrato): Document {
  const isClube = D.perfil === "clube";
  const k: (Paragraph | Table)[] = [];

  const divStandalone = D.divulgacao === "simples" ? 1 : 0;
  const nVigencia = 10 + divStandalone;
  const nRescisao = nVigencia + 1;
  const nConfid = nRescisao + 1;
  const nExclus = nConfid + 1;
  const nDisp1 = nExclus + 1;
  const nDisp2 = nDisp1 + 1;
  const nDisp3 = nDisp2 + 1;
  const nDisp4 = nDisp3 + 1;
  const nForo = nDisp4 + 1;

  k.push(H("INSTRUMENTO PARTICULAR DE USO DO SOFTWARE FOOTLINK"));

  // Partes
  k.push(
    P([
      B(`CONTRATANTE: ${D.cliente}, `),
      R(
        `pessoa jurídica de direito privado, inscrita no CNPJ sob nº ${D.cnpj}, com endereço à ${D.endereco}, neste ato representado na forma prevista em seu Estatuto Social`,
      ),
      R(textoRepresentantesContratante(D.representantesContratante)),
      R(", adiante denominado "),
      B("“CONTRATANTE”;"),
    ]),
  );
  k.push(
    P([
      B("CONTRATADA: FOOTURE PRODUTORA DE CONTEUDO, SOFTWARE E SERVICOS LTDA, "),
      R(
        "pessoa jurídica de direito privado, inscrita no CNPJ/MF sob nº 32.527.841/0001-48, com sede na cidade de Porto Alegre – RS, na Rua Dr. Barbosa Gonçalves 69, bairro Chácara das Pedras, neste ato representado na forma prevista em seu Estatuto Social, adiante denominada como ",
      ),
      B("“CONTRATADA”;"),
    ]),
  );
  k.push(
    P(
      "Ajustam as partes, de mútuo e comum acordo, o presente Contrato de Licenciamento de Software, o qual será regido nos seguintes termos e condições abaixo descritas:",
    ),
  );

  // Objeto
  k.push(H("DO OBJETO"));
  let objeto =
    "Faz parte do objeto do presente contrato a (i) comercialização da Licença de Uso temporária e não exclusiva do software de gerenciamento e gestão de atletas de futebol, doravante denominado “FOOTLINK”";
  if (D.api)
    objeto +=
      "; e (ii) comercialização da Licença de Acesso temporário da Interface de Programação de Aplicação/Application Programming Interface (API) do software FOOTLINK, que dará acesso a dados de competições, atletas monitorados, atletas inseridos pela organização, avaliações, relatórios e projetos";
  // Confirmado: sem API termina em ";" (PANTANAL_teste); com API termina em "." (CORINTHIANS).
  objeto += D.api ? "." : ";";
  k.push(P([B("CLÁUSULA PRIMEIRA: "), R(objeto)]));
  if (D.robusta)
    k.push(
      P([
        B("Parágrafo 1º: "),
        R(
          "A CONTRATADA garante que as funcionalidades descritas na Cláusula Sexta serão mantidas durante todo o período de vigência do contrato, não podendo ser suprimidas ou reduzidas. Qualquer alteração significativa deverá ser previamente comunicada e dependerá da anuência expressa do CONTRATANTE. Fica ressalvada a possibilidade de suspensão temporária nas hipóteses da Cláusula Nona.",
        ),
      ]),
    );

  // PI
  const apiSep = D.api ? " e sua interface API" : "";
  k.push(H("DA PROPRIEDADE INTELECTUAL"));
  k.push(
    P([
      B("CLÁUSULA SEGUNDA: "),
      R(
        `O CONTRATANTE reconhece como da CONTRATADA todos os direitos concernentes ao software FOOTLINK${apiSep}. Aplicam-se, adicionalmente, as regras estabelecidas na Lei 9.609/98 para o fim de regular as demais normas a respeito da titularidade da propriedade intelectual decorrente do software FOOTLINK de titularidade da CONTRATADA.`,
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 1º: "),
      R(
        `Todos os direitos autorais e de propriedade intelectual do software FOOTLINK${apiSep} e de obras derivadas são e permanecerão sendo de propriedade única e exclusiva da CONTRATADA. A CONTRATANTE declara que não terá qualquer direito ou ação sobre o software FOOTLINK, exceto a licença temporária de uso, onerosa e não exclusiva, nos termos acordados nesse Contrato.`,
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 2º: "),
      R(
        "Todas as modificações, melhorias, correções e novas versões do software FOOTLINK ou de obras derivadas, mesmo que informadas, solicitadas e, eventualmente, pagas pela CONTRATANTE, ficarão incorporadas ao software FOOTLINK e sujeitas aos termos e condições deste Contrato, podendo, inclusive, ser disponibilizada/comercializada pela CONTRATADA a terceiros, assim como a CONTRATANTE poderá, também, receber melhorias de funcionamento, correções e novos recursos do software FOOTLINK que tenham sido informados, solicitados e, eventualmente, pagos por terceiros.",
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 3º: "),
      R(
        `É vedado à CONTRATANTE, na pessoa de seus sócios, representantes, empregados, fornecedores ou terceiros interessados, copiar, alterar, desmontar, descompilar, efetuar engenharia reversa ou tomar qualquer providência visando obter os códigos-fonte do software FOOTLINK${apiSep}, devendo responder pelas perdas e danos que comprovadamente der causa, sem qualquer limitação de valor, incluindo danos diretos, indiretos, lucros cessantes e indenização devida a terceiros.`,
      ),
    ]),
  );

  // Suporte
  k.push(H("DO SUPORTE TÉCNICO"));
  k.push(
    P([
      B("CLÁUSULA TERCEIRA: "),
      R(
        `A CONTRATADA se obriga, no decorrer do prazo de vigência da presente relação contratual, a conceder pleno suporte ao CONTRATANTE para utilização do FOOTLINK${D.api ? " e da API" : ""}.`,
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 1º: "),
      R(
        "Os Serviços técnicos de suporte e manutenção serão efetuados pela CONTRATADA desde que não sejam causados por: (i) Negligência ou uso inadequado do Software pela CONTRATANTE; ou (ii) Uso do Software pela CONTRATANTE para fins diversos do qual foi projetado.",
      ),
    ]),
  );
  const sla = D.robusta
    ? "a CONTRATADA se compromete a manter um SLA de disponibilidade mínima de 98% (noventa e oito por cento) ao ano"
    : "a CONTRATADA se compromete a manter um SLA de disponibilidade anual o mais elevado possível";
  k.push(
    P([
      B("Parágrafo 2º: "),
      R(
        `Partindo-se da premissa de que em prestação de serviços na área de informática não existe garantia integral de manutenção do Software no ar durante 100% (cem por cento) do tempo, ${sla}, ressalvadas as seguintes hipóteses: i. Interrupções necessárias para ajustes técnicos ou manutenção; ii. Intervenções emergenciais decorrentes da necessidade de preservar a segurança do Software; iii. Suspensão da prestação dos Serviços contratados por determinação de autoridades competentes, ou por descumprimento de cláusulas do presente Contrato.`,
      ),
    ]),
  );
  const canais = D.robusta ? ", através do WhatsApp nº (51) 9782-3228 e do e-mail support@footlink.app" : "";
  k.push(
    P([
      B("CLÁUSULA QUARTA: "),
      R(
        `Independente da possibilidade do suporte presencial, a CONTRATADA se compromete a prestar o suporte para utilização do FOOTLINK por meio de suas linhas de comunicação e de serviço de atendimento online${canais}.`,
      ),
    ]),
  );
  k.push(
    P([
      B("CLÁUSULA QUINTA: "),
      R(
        "O suporte para acesso e uso do FOOTLINK será prestado pela CONTRATADA através de seus sócios, empregados, estagiários e, eventualmente, por profissionais especialmente contratados em virtude de suas habilidades e conhecimentos técnicos específicos.",
      ),
    ]),
  );

  // Preço e licenças
  k.push(H("DO PREÇO E DAS LICENÇAS"));
  k.push(P([B("CLÁUSULA SEXTA: "), R("A configuração dos serviços do software FOOTLINK, ora contratado, é a detalhada abaixo:")]));
  k.push(featTable(D.plano, D.features));
  k.push(
    P([
      B("Parágrafo 1º: "),
      R(
        `As licenças individuais contratadas serão distribuídas em 2 (dois) níveis de acesso, “gerencial” e “analista”, conforme lista a ser enviada pelo ${isClube ? "clube" : "CONTRATANTE"} após a assinatura do contrato.`,
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 2º: "),
      R("Não excedendo o número de licenças contratadas, a alteração de níveis de acesso, inclusão e troca de logins poderão ser feitas pela CONTRATANTE a qualquer momento, sem qualquer custo adicional."),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 3º: "),
      R(`Caso a CONTRATANTE queira contratar mais licenças que as que constam no presente contrato, será acrescido ao pagamento mensal o valor de ${D.licAdicional}/mês por licença. A cobrança das licenças adicionais se dará na próxima fatura em aberto do contrato.`),
    ]),
  );

  // Valor (Sétima) + Pagamento (Oitava)
  // Contador de parágrafo da Sétima — não hardcoded, porque a combinação de API
  // "distintos" + divulgação "obrigacao" pode empilhar mais de um §.
  let paragrafoSetima = 0;
  const proxParagrafoSetima = () => {
    paragrafoSetima += 1;
    return `Parágrafo ${paragrafoSetima}º: `;
  };

  if (D.pagamento === "parcelado") {
    // Confirmado contra PANTANAL_teste/ELENKO_teste: o número de parcelas aparece
    // puro ("12 pagamentos fixos"), sem extenso entre parênteses.
    const numeroParcelas = D.numeroParcelas ?? 12;
    if (D.api && D.apiModelo === "distintos" && D.mensalApi && D.mensalSoftware) {
      k.push(
        P([
          B("CLÁUSULA SÉTIMA: "),
          R(
            `Pela configuração e serviços descritos acima, o CONTRATANTE pagará à CONTRATADA o valor total de ${D.total}, em ${numeroParcelas} parcelas mensais de ${D.mensal}, sendo cada parcela composta por: (i) ${D.mensalApi} referentes à utilização da API; e (ii) ${D.mensalSoftware} referentes à licença de uso do software FOOTLINK.`,
          ),
        ]),
      );
      k.push(
        P([
          B(proxParagrafoSetima()),
          R(
            `Fica estabelecido que, para cada parcela mensal, serão emitidos boletos bancários distintos, sendo um boleto no valor de ${D.mensalApi} relativo à API e outro no valor de ${D.mensalSoftware} relativo ao software FOOTLINK.`,
          ),
        ]),
      );
    } else {
      // Cobre também apiModelo "combinado": o total/mensal já vêm somados
      // (software + API), então o texto é o mesmo do caso sem API.
      k.push(
        P([
          B("CLÁUSULA SÉTIMA: "),
          R(
            `Pela configuração e serviços descritos acima, contratado na modalidade anual, o CONTRATANTE pagará à CONTRATADA o valor total de ${D.total}, parcelados em ${numeroParcelas} pagamentos fixos de ${D.mensal} ao mês a título de Licença de Uso do software FOOTLINK.`,
          ),
        ]),
      );
      // Confirmado contra GOIAS/ELENKO (fidelidade original) e PANTANAL_teste/
      // ELENKO_teste (linha Scout) — universal pra parcelado sem API.
      k.push(
        P([
          B(proxParagrafoSetima()),
          R(
            "Para fins deste contrato, a obrigação financeira é assumida de forma integral pelo período de 12 (doze) meses, não se confundindo com a forma de pagamento ajustada, que constitui mera facilidade concedida ao CONTRATANTE.",
          ),
        ]),
      );
    }
    if (D.divulgacao === "obrigacao") k.push(...blocoDivulgacaoObrigacao(D, proxParagrafoSetima));

    if (D.metodo === "pix") {
      k.push(
        P([
          B("CLÁUSULA OITAVA: "),
          R(
            `Ajustam as partes que os pagamentos se darão através de transferência eletrônica (pix), cabendo ao CONTRATANTE a obrigação de envio imediato do comprovante de pagamento ao e-mail financeiro@footure.com.br, tão logo este seja realizado. O pagamento será realizado até o dia ${D.diaVenc || "25"} de cada mês, com apresentação da nota fiscal, e previsão do primeiro pagamento a partir de ${D.primeiroVenc}, através dos seguintes dados bancários:`,
          ),
        ]),
      );
      k.push(...pixBankBlock());
    } else {
      k.push(
        P([
          B("CLÁUSULA OITAVA: "),
          R(
            `Em relação à forma e prazo para pagamento, ajustam as partes que o pagamento se dará através de boleto bancário, com vencimento até o dia ${D.diaVenc || "10"} de cada mês, cabendo ao CONTRATANTE a obrigação de efetuar o pagamento no prazo estipulado, sendo o primeiro vencimento pactuado para ${D.primeiroVenc}:`,
          ),
        ]),
      );
    }
    k.push(parcTable(D.parcelas));
    // Revisão jurídica (contrato Londrina, set/2026): sem isso, o texto abre
    // margem pra interpretação de cobrança postecipada (uso prévio sem
    // quitação garantida). D.parcelas[0].periodo já calcula a data certa
    // (vencimento da 1ª parcela até vencimento+1 mês-1 dia), igual ao
    // exemplo revisado — não precisa recalcular aqui.
    if (D.parcelas[0]) {
      k.push(
        P([
          B("Parágrafo único: "),
          R(
            `As PARTES reconhecem e ajustam que a licença de uso do software é disponibilizada mediante pagamento antecipado das mensalidades, correspondendo cada parcela ao período de licenciamento imediatamente subsequente ao seu vencimento. Considerando que o acesso ao sistema foi disponibilizado à CONTRATANTE em ${D.primeiroVenc}, data em que ocorreu o pagamento da primeira parcela, fica estabelecido que a vigência inicial da licença compreenderá o período de ${D.parcelas[0].periodo}, sendo as demais parcelas destinadas à manutenção da licença de uso dos períodos subsequentes, observados os vencimentos previstos neste instrumento.`,
          ),
        ]),
      );
    }
  } else {
    // À vista. Bloco com API discriminada: SEM precedente em contrato real —
    // por analogia ao padrão Corinthians (parcelado+API), adaptado para
    // parcela única. Revisar com jurídico antes de usar em produção.
    if (D.api && D.apiModelo === "distintos" && D.mensalApi && D.mensalSoftware) {
      k.push(
        P([
          B("CLÁUSULA SÉTIMA: "),
          R(
            `Pela configuração e serviços descritos acima, o CONTRATANTE pagará à CONTRATADA o valor total de ${D.total} em parcela única, sendo o valor composto por: (i) ${D.mensalApi} referentes à utilização da API; e (ii) ${D.mensalSoftware} referentes à licença de uso do software FOOTLINK.`,
          ),
        ]),
      );
      k.push(
        P([
          B(proxParagrafoSetima()),
          R(
            `Fica estabelecido que serão emitidos boletos bancários distintos, sendo um boleto no valor de ${D.mensalApi} relativo à API e outro no valor de ${D.mensalSoftware} relativo ao software FOOTLINK.`,
          ),
        ]),
      );
    } else {
      k.push(
        P([
          B("CLÁUSULA SÉTIMA: "),
          R(`Pela configuração e serviços descritos acima, o CONTRATANTE pagará à CONTRATADA o valor de ${D.total} em parcela única a título de Licença de Uso do software FOOTLINK.`),
        ]),
      );
    }
    if (D.divulgacao === "obrigacao") k.push(...blocoDivulgacaoObrigacao(D, proxParagrafoSetima));

    k.push(
      P([
        B("CLÁUSULA OITAVA: "),
        R(`O pagamento se dará através de boleto bancário, com vencimento em ${D.vencAvista || "30 (trinta) dias corridos contados a partir da data de envio do boleto à CONTRATANTE"}.`),
      ]),
    );
  }

  // Mora
  k.push(
    P([
      B("CLÁUSULA NONA: "),
      R(
        `O não pagamento no prazo ajustado implicará a incidência de juros de mora de 1% (um por cento) ao mês e multa de 2% (dois por cento), ambos sobre o valor em atraso, com correção pelo IGPM-FGV até o efetivo pagamento. O inadimplemento superior a 30 (trinta) dias autorizará o imediato cancelamento da licença e a suspensão das senhas de acesso ao Software Footlink${D.api ? " e ao API do FOOTLINK" : ""}, a critério da CONTRATADA, sem prejuízo da rescisão prevista na Cláusula ${ORD[nRescisao]}, incluindo a aplicação da penalidade contratual estipulada no referido dispositivo.`,
      ),
    ]),
  );

  // Divulgação "simples" — cláusula standalone (desloca a numeração das seguintes)
  if (D.divulgacao === "simples")
    k.push(
      P([
        B(CL(10)),
        R(
          "O CONTRATANTE autoriza à CONTRATADA a publicação da prestação dos serviços como referência em seu site e em suas redes sociais (Instagram, twitter, facebook e linkedin) @FootureFC, @footlink.app, @Footlink.",
        ),
      ]),
    );

  // Vigência e rescisão
  k.push(H("DA VIGÊNCIA E DA RESCISÃO"));
  k.push(
    P([
      B(CL(nVigencia)),
      R(`O presente contrato é celebrado por prazo determinado de 12 (doze) meses, iniciando-se em ${D.vigIni} e encerrando-se em ${D.vigFim}, sendo que, findo o período e havendo interesse das partes, deverão celebrar novo instrumento contratual.`),
    ]),
  );
  k.push(P([B(CL(nRescisao)), R(D.multaTexto)]));
  k.push(
    P([
      B("Parágrafo 1º: "),
      R("O CONTRATANTE que pretender rescindir ou cancelar sua assinatura deverá formalizar a solicitação exclusivamente por comunicação escrita ao e-mail cancelamentos@footure.com.br, com antecedência mínima de 30 (trinta) dias."),
    ]),
  );

  // Confidencialidade + LGPD
  k.push(H("DA CONFIDENCIALIDADE E EXCLUSIVIDADE"));
  k.push(
    P([
      B(CL(nConfid)),
      R("A CONTRATADA obriga-se expressamente a manter em estrito sigilo as informações confidenciais recebidas, bem como a não utilizá-las para outros fins. Da mesma forma, o CONTRATANTE obriga-se a não utilizar isoladamente, divulgar ou repassar para terceiros as metodologias e tecnologias utilizadas pela CONTRATADA, bem como a manter em estrito sigilo as informações confidenciais dela recebidas."),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 1º: "),
      R(
        "As Partes concordam em tratar como sigilosas e confidenciais todas as eventuais informações escritas, orais ou de qualquer outra forma, a que tiverem acesso em decorrência deste Contrato, em especial aquelas que contenham, dados pessoais, informações técnicas, estratégicas, econômicas ou de mercado das Partes, salvo mediante autorização escrita em contrário.",
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 2º: "),
      R("Eventual obrigação de sigilo e confidencialidade relativa às informações incluídas e/ou extraídas do Software FOOTLINK é de exclusiva responsabilidade do CONTRATANTE."),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 3º: "),
      R(
        "Não há restrição de divulgação de informações quando: a) a informação se torna pública ou disponível ao público de outra maneira do que através da Parte Receptora; b) quando a informação é obtida através de terceiros com autorização para revelar tal informação; e c) quando puder ser demonstrado para a Parte Reveladora, que a informação já era do conhecimento prévio da Parte Receptora no momento de seu recebimento.",
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 4º: "),
      R(
        "É vedada a divulgação pelas partes, a qualquer tempo e sob qualquer forma, de dados, criações e informações confidenciais obtidos em virtude deste ajuste (“Informações Confidenciais”), salvo com o expresso consentimento da outra parte. Não são consideradas Informações Confidenciais as informações que: (i) sejam de domínio público; ou (ii) já estejam em poder da outra parte e tenham sido obtidas de forma lícita. É permitido o fornecimento de Informações Confidenciais em razão de ordem administrativa ou judicial emitida por autoridade competente, não excedido o limite de tal ordem, desde que a parte que a recebeu notifique outra parte previamente ao fornecimento, por escrito, dando a esta última, na medida do possível, tempo hábil para pleitear as medidas de proteção do sigilo que julgar cabíveis. A presente disposição perdurará durante a vigência deste ajuste e pelo prazo de 05 (cinco) anos a contar do seu término.",
      ),
    ]),
  );
  if (D.robusta) {
    k.push(...lgpdReforcada());
  } else {
    k.push(
      P([
        B("Parágrafo 5º: "),
        R(
          "A CONTRATANTE declara expresso consentimento para que a CONTRATADA colete, trate e compartilhe os dados necessários ao cumprimento do contrato, nos termos do Art. 7º, incisos II, V, IX e X da LGPD. Outros dados poderão ser coletados conforme termo de consentimento específico.",
        ),
      ]),
    );
  }
  k.push(
    P([
      B("Parágrafo 6º: "),
      R(
        "Serão, ainda, consideradas informações confidenciais todas aquelas não listadas acima, mas, que assim forem identificadas pelas partes, através de legendas ou quaisquer outras marcações, ou que, devido às circunstâncias da revelação ou a própria natureza da informação, devam ser consideradas como confidenciais.",
      ),
    ]),
  );
  k.push(
    P([
      B(CL(nExclus)),
      R("O presente contrato não implica qualquer exclusividade entre as partes, podendo cada qual contratar serviços semelhantes junto a terceiros."),
    ]),
  );

  // Disposições gerais
  k.push(H("DAS DISPOSIÇÕES GERAIS"));
  k.push(
    P([B(CL(nDisp1)), R("Havendo contradição entre este instrumento e a Proposta Comercial ou qualquer outro documento, prevalecerá o disposto neste contrato.")]),
  );
  k.push(
    P([
      B(CL(nDisp2)),
      R("O CONTRATANTE reconhece que as informações do FOOTLINK são obtidas de fontes oficiais e não oficiais públicas lícitas; eventual incorreção não é responsabilidade da CONTRATADA nem justifica rescisão."),
    ]),
  );
  k.push(
    P([
      B(CL(nDisp3)),
      R("Encerrada a vigência sem prorrogação, as informações inseridas serão entregues em arquivo “csv” e, após, imediatamente excluídas junto com as senhas e logins de acesso."),
    ]),
  );
  // Confirmado contra contrato real feito pelo jurídico (Boavista, out/2026):
  // é UMA cláusula com 3 parágrafos (sucessores/inadimplemento, força maior,
  // tolerância/renúncia) — não 2 cláusulas separadas como a versão anterior.
  k.push(
    P([
      B(CL(nDisp4)),
      R(
        "Este ajuste somente poderá ser alterado, substituído, rescindido, renovado ou prorrogado por instrumento escrito assinado pelas partes, além de constituir o entendimento completo entre as partes, substituindo quaisquer acordos ou entendimentos anteriores, verbais ou escritos.",
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 1º: "),
      R(
        "O presente ajuste obriga as partes e seus sucessores a qualquer título, sendo certo que o inadimplemento de obrigações das partes neste ajuste poderá se verificar por ato ou fato imputável às PARTES ou a terceiros em nome das PARTES.",
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 2º: "),
      R(
        "A parte afetada por qualquer evento de força maior ou caso fortuito comunicará o fato à outra parte imediatamente, esclarecendo as circunstâncias, as ações em curso para amenizar as perdas e solucionar o ocorrido, o tempo estimado de duração e tudo o mais que for necessário à compreensão do fato, suas consequências e solução.",
      ),
    ]),
  );
  k.push(
    P([
      B("Parágrafo 3º: "),
      R(
        "Fica expressa e irrevogavelmente avençado que a abstenção do exercício, por qualquer das partes, de direito ou faculdade que lhes assistam em razão deste ajuste, ou a concordância com o atraso no cumprimento das obrigações da outra parte não afetará aquele direito ou faculdade, os quais poderão ser exercidos, a qualquer tempo, a exclusivo critério de seu titular, e tampouco alterará as condições pactuadas neste termo.",
      ),
    ]),
  );

  // Foro
  k.push(H("DO FORO"));
  k.push(
    P([B(CL(nForo)), R(`Elegem as partes o Foro Central da Comarca de ${D.foro}, para dirimir quaisquer questões oriundas do presente contrato.`)]),
  );

  // Assinaturas (página própria)
  k.push(...blocoAssinaturas(D));

  return new Document({
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } },
        },
        headers: { default: buildHeader() },
        footers: { default: buildFooter(D) },
        children: k,
      },
    ],
  });
}

export async function gerarContratoBuffer(D: DadosContrato): Promise<Buffer> {
  return Packer.toBuffer(gerarContrato(D));
}
