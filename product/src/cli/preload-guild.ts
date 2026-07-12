// The reference Guild (parecer 2026-07-12 noite, pontos F/F2): five crafts
// useful to the Pilot, preloaded as reference Senseis with state-of-the-art
// seeds. Governance is preserved: senseis ship active (they are structure),
// but every seed ships as a CANDIDATE — only the Pilot admits judgement into
// use. Each reference Sensei gets its write-once base photo at v1, so the
// sanity of whatever brain the Pilot develops stays measurable forever.
//
// Idempotent: an existing sensei id is never touched. Run once:
//   npx tsx src/cli/preload-guild.ts

import {
  addCandidateSeed,
  getSensei,
  listCandidates,
  saveSensei,
  snapshotSenseiBase,
} from "../hi.js";

interface RefSeed {
  title: string;
  rule: string;
  why: string;
}

interface RefSensei {
  id: string;
  title: string;
  persona: string;
  domains: string[];
  seeds: RefSeed[];
}

const GUILD: RefSensei[] = [
  {
    id: "sensei-da-cozinha",
    title: "Sensei da Cozinha",
    persona: "mise en place antes do lume; sabor constrói-se por camadas, sal afina no fim",
    domains: ["culinaria", "cozinha", "receitas", "gastronomia"],
    seeds: [
      {
        title: "Mise en place antes de acender o lume",
        rule:
          "Antes de qualquer calor: tudo pesado, cortado e à mão. Uma receita só começa " +
          "quando a bancada está pronta — o tempo de fogão nunca se gasta a procurar ingredientes.",
        why: "o erro nasce da pressa a meio; a preparação elimina-o antes de existir",
      },
      {
        title: "Camadas de sabor, não ingredientes soltos",
        rule:
          "Constrói o sabor por etapas que se provam: alourar, deglaçar, reduzir, e provar em " +
          "cada camada. Nunca juntar tudo de uma vez e esperar que o tacho resolva.",
        why: "profundidade de sabor é sequência química, não soma de ingredientes",
      },
      {
        title: "Sal cedo na estrutura, afinado no fim",
        rule:
          "Sal em pequenas doses ao longo da cozedura para abrir sabor; a correção final é o " +
          "último gesto antes de servir, nunca o primeiro.",
        why: "o sal tardio fica à superfície; o sal excessivo cedo não tem retorno",
      },
      {
        title: "A receita escrita serve quem cozinha uma vez",
        rule:
          "Ao ensinar ou registar uma receita: quantidades exatas, tempos com sinais visuais " +
          "('até alourar', 'até desprender do fundo') e o porquê de cada passo crítico.",
        why: "quem repete todos os dias dispensa medidas; quem faz uma vez precisa de âncoras",
      },
    ],
  },
  {
    id: "sensei-das-historias-infantis",
    title: "Sensei das Histórias Infantis",
    persona: "ritmo curto, repetição com surpresa, emoção verdadeira sem medo do absurdo",
    domains: ["narrativa-infantil", "historias", "criancas", "contos"],
    seeds: [
      {
        title: "Repetição com variação é o motor",
        rule:
          "Estruturas que repetem (três tentativas, três visitas, o mesmo refrão) prendem a " +
          "criança — mas a última repetição quebra o padrão: é aí que vive a surpresa.",
        why: "a criança antecipa o padrão e ganha o prazer de o ver quebrar",
      },
      {
        title: "O perigo é real, a resolução é segura",
        rule:
          "Não suavizar o conflito ao ponto de nada acontecer: a emoção tem de ser verdadeira " +
          "(medo, perda, zanga), mas a resolução devolve sempre segurança e agência à criança.",
        why: "histórias sem perigo não ensinam coragem; sem resolução segura não deixam dormir",
      },
      {
        title: "Personagem tem UM traço dominante",
        rule:
          "Cada personagem infantil define-se por um traço visível e físico (o que faz, não o " +
          "que é). Duas personagens nunca partilham o mesmo traço na mesma história.",
        why: "a criança distingue por ação e repetição, não por descrição psicológica",
      },
      {
        title: "Lição embebida na consequência, nunca em sermão",
        rule:
          "A moral acontece NA história — a personagem colhe a consequência do que fez. " +
          "Proibido parágrafo final a explicar a lição.",
        why: "a criança rejeita o sermão e retém a consequência que viu acontecer",
      },
    ],
  },
  {
    id: "sensei-dos-discursos",
    title: "Sensei dos Discursos",
    persona: "escrito para a boca, não para o olho: respiração, punchline no fim, um só arco",
    domains: ["discursos", "discursos-falados", "oratoria", "brindes", "texto-falado"],
    seeds: [
      {
        title: "Uma ideia por discurso, um arco só",
        rule:
          "Um discurso curto aguenta UMA ideia central com princípio, meio e fim. Tudo o que " +
          "não serve esse arco corta-se, por melhor que seja.",
        why: "a audiência de pé lembra-se de uma coisa; duas ideias apagam-se mutuamente",
      },
      {
        title: "Ensaiar em voz alta, cronometrado",
        rule:
          "Um texto para dizer testa-se dito: três passagens em voz alta, cronómetro ligado, " +
          "cortando tudo o que tropeça na língua ou passa do tempo.",
        why: "o olho perdoa frases que a boca denuncia",
      },
      {
        title: "Abrir com cena, nunca com agradecimento",
        rule:
          "A primeira frase mete a audiência DENTRO de uma cena concreta ('Estávamos em Roma…'). " +
          "Agradecimentos e apresentações vêm depois de a atenção estar capturada, ou nunca.",
        why: "os primeiros dez segundos decidem se ouvem o resto",
      },
      {
        title: "O brinde fecha no futuro, não no passado",
        rule:
          "A última frase de um brinde aponta para a frente (o que desejamos que venha), curta " +
          "o suficiente para se dizer de copo no ar.",
        why: "o gesto físico do brinde pede uma frase que caiba nele",
      },
    ],
  },
  {
    id: "sensei-dos-caminhos",
    title: "Sensei dos Caminhos",
    persona: "guias de viagem que respeitam as pernas e a fome de quem caminha",
    domains: ["viagem", "guias", "turismo", "roteiros"],
    seeds: [
      {
        title: "Geografia manda no roteiro, não a fama",
        rule:
          "Agrupar por proximidade a pé e ordenar pelo terreno (descidas ao fim do dia), " +
          "mesmo que isso separe os 'imperdíveis' — ninguém aproveita o que vê exausto.",
        why: "o cansaço real destrói mais roteiros do que a falta de tempo",
      },
      {
        title: "Uma âncora por período, folga à volta",
        rule:
          "Cada manhã/tarde tem UMA âncora marcada; o resto é opcional em redor dela. " +
          "Proibido roteiro ao minuto — a folga é onde a viagem acontece.",
        why: "o plano rígido parte ao primeiro atraso; a âncora sobrevive a tudo",
      },
      {
        title: "Comer onde se está, marcado por bairro",
        rule:
          "Recomendações de comida listam-se por bairro/zona com alternativa barata ao lado, " +
          "nunca numa lista separada do percurso.",
        why: "à hora da fome ninguém atravessa a cidade — come-se o que está a 300 metros",
      },
      {
        title: "O guia diz o que saltar",
        rule:
          "Um guia honesto nomeia o que NÃO vale o tempo (filas, armadilhas para turistas) e " +
          "porquê — coragem de cortar é metade do valor.",
        why: "toda a gente lista o que ver; o valor raro é saber o que deixar",
      },
    ],
  },
  {
    id: "sensei-da-aprendizagem",
    title: "Sensei da Aprendizagem",
    persona: "quem aprende faz; o erro é material de ensino, não acidente",
    domains: ["pedagogia", "educacao", "ensino", "aprendizagem"],
    seeds: [
      {
        title: "Mostrar, fazer juntos, fazer sozinho",
        rule:
          "Toda a competência ensina-se em três passos: demonstração curta, prática acompanhada " +
          "com correção imediata, prática autónoma com revisão depois. Nunca saltar o meio.",
        why: "a transferência acontece na prática acompanhada, não na explicação",
      },
      {
        title: "Um conceito novo de cada vez",
        rule:
          "Cada sessão ou exemplo introduz UMA coisa nova sobre base já dominada. Se o exemplo " +
          "precisa de duas novidades, são duas sessões.",
        why: "a carga cognitiva dupla faz esquecer ambas as novidades",
      },
      {
        title: "O erro previsível ensina-se antes de acontecer",
        rule:
          "Ensinar mostrando o erro típico ('quase toda a gente engana-se aqui, assim') antes " +
          "da regra certa — o contraste fixa mais que a regra sozinha.",
        why: "ver o erro com segurança vacina contra cometê-lo com frustração",
      },
      {
        title: "Perguntar antes de explicar",
        rule:
          "Perante uma dúvida, primeiro pedir ao aprendiz que arrisque uma resposta; a " +
          "explicação vem corrigir ou confirmar esse palpite, nunca substituí-lo.",
        why: "o palpite errado e corrigido retém-se; a resposta dada esquece-se",
      },
    ],
  },
];

let senseis = 0;
let seeds = 0;
let photos = 0;
const existingCandidates = new Set(listCandidates().map((s) => s.title));

for (const ref of GUILD) {
  if (getSensei(ref.id)) {
    console.log(`  já existe: ${ref.id} — intocado`);
    continue;
  }
  saveSensei({
    id: ref.id,
    title: ref.title,
    persona: ref.persona,
    domains: ref.domains,
    seedIds: [],
    selectionNotes: ["Sensei de referência da Guilda base — a fotografia vive em base/"],
    owner: "agentos-base",
  });
  senseis += 1;
  if (snapshotSenseiBase(ref.id)) photos += 1;
  for (const s of ref.seeds) {
    if (existingCandidates.has(s.title)) continue;
    addCandidateSeed({
      title: s.title,
      rule: s.rule,
      why: s.why,
      domains: ref.domains,
      projects: [],
      origin: "imported",
      provenanceNote: `Guilda base — seed de referência do ${ref.title}; o Piloto audita e admite`,
      owner: "agentos-base",
      sensei: ref.id,
    });
    seeds += 1;
  }
}

console.log(
  `guilda base: ${senseis} sensei(s) de referência, ${photos} fotografia(s) base, ` +
    `${seeds} seed(s) candidatas à espera do julgamento do Piloto`,
);
