# Parecer do Piloto — 2026-07-12 (noite), após o primeiro teste humano

O Piloto usou o produto pela primeira vez como utilizador real (projeto
"teste teste, historia estranho de uma criança xD", 18 work orders, 2
Decision Surfaces decididas, candidato construído). Gostou do conjunto —
"está a funcionar e de acordo com o que pretendo" — e devolveu um parecer
de enriquecimento. Este documento fixa o parecer, as decisões tomadas em
entrevista, e o plano. As dúvidas foram entrevistadas antes de codificar
(diretiva expressa: nunca assumir).

## Os pontos, na voz do Piloto (condensados)

- **A)** Uma GuruSeed deve aplicar-se a UM agente-perito, não a todos de
  forma transversal. O modelo atual (domínio vazio = universal) está errado.
- **B)** A entidade-perita precisa de nome próprio (era "Mentor").
  **Decidido em entrevista: SENSEI.** A metáfora é o dojo: graduações
  (faixas) que se conquistam com uso e vitórias.
- **C)** Proveniência evidente de QUEM sugeriu o quê — e só quem foi
  escolhido evolui. "Como um Pokémon que ganha a fight, evolui e adquire
  novas competências baseado no que aprendeu e nos resultados." Ranking.
- **D)** Esforço escolhível por fase (perguntas vs opções vs execução),
  de forma prévia ao lançamento de cada acontecimento.
  **Decidido: perfil por fase no projeto + slider de override por
  lançamento; re-consultas automáticas usam o perfil (escolha explícita
  do Piloto respeita a linha de autoridade).**
- **E)** Nunca esquecer os logs da app — fecham o loop de informação para
  o Copiloto medir a qualidade da app e do kernel face a desenvolver o
  mesmo projeto num único prompt de terminal. Métricas para validar o
  conceito. NÃO PODE FICAR ESQUECIDO.
- **F)** A biblioteca deve vir pré-carregada com expertise de referência
  por profissão (devagar, mas é esse o objetivo): estado-da-arte por
  ofício, e o agentOS aprende com o uso.
  **Decidido: começar com 5 ofícios úteis ao Piloto — culinária,
  narrativa infantil, discursos falados, guias de viagem, pedagogia.
  Seeds geradas pelo Copiloto (origin=imported), auditadas pelo Piloto
  antes de admitidas.**
- **F2)** Risco de o utilizador ensinar mal/tendenciosamente os Senseis.
  Proposta do Piloto: manter os Senseis de referência FIXOS (fotografia
  de um cérebro equilibrado); a app usa CÓPIAS que evoluem; a fotografia
  serve para medir a sanidade do cérebro desenvolvido. **Confirmado:
  alinha com a imutabilidade já implementada (versões write-once).**
- **G)** Absorção de expertise por fotos/vídeo (ex.: captar a mãe a
  cozinhar) e entrevistas de absorção, num menu separado da área de
  projetos. **Decidido: ROADMAP — desenvolve-se noutra altura. v1 será
  fotos + entrevista; vídeo (amostragem de frames) na v2.**
- **H)** O parecer do primeiro teste está embebido nos pontos acima.
- **I)** Ver tokens gastos durante as iterações + temporizador visível
  ("o sistema está a pensar e a gastar tokens").
- **J)** 3 opções no DECIDIR em vez de 2. *Facto verificado: o nº de
  opções já segue o esforço (low=2, balanced=3, high=4); custo de cada
  opção extra = 1 chamada, linear.* Passa a haver controlo explícito
  (2–4) no lançamento, com custo visível no probe.

## O plano (fatias, cada uma commit+push)

1. **A Reforma Sensei (A+B+C+F2):** Mentor→Sensei (migração mecânica,
   histórico preservado); cada seed pertence a UM Sensei (fim do
   transversal); vitória em Decision Surface credita o Sensei escolhido
   (telemetria append-only `victories.jsonl`); graduação derivada
   (faixas); fotografia de referência write-once em `base/`; sanidade =
   diff ativo-vs-base.
2. **Esforço por fase (D):** `effortProfile` no projeto (perguntas /
   opções / execução), editável; slider continua como override;
   re-consultas automáticas usam o perfil.
3. **Visibilidade (I+J):** temporizador + tokens ao vivo no cartão de
   trabalho; contador de tokens da iteração; seletor de nº de opções.
4. **Guilda base (F):** 5 Senseis de referência pré-carregados com seeds
   estado-da-arte (candidatas — o Piloto admite), fotografia em base/.
5. **Métricas (E):** extrator por projeto (perguntas, tokens, tempos,
   decisões, seeds aplicadas, vitórias) — fundação da comparação
   agentOS-vs-prompt-único.

## Roadmap registado (não esquecer)

- **Absorção de Expertise** (menu próprio): fotos + entrevistas de
  absorção → seeds candidatas para o Sensei escolhido; vídeo na v2.
- **Evolução sugerida pelo sistema:** após vitórias/evidência, o sistema
  propõe novas seeds ou revisões ao Sensei — sempre governadas pelo
  Piloto (ADR-0020).
- **Comparação de baseline (E):** o mesmo brief num único prompt vs o
  produto governado — métricas lado a lado.
