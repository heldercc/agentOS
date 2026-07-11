# Heritage — Knowledge Export from the Founding Sessions

Source: ChatGPT (founding Copilot), at the Pilot's request, July 2026.
Status: historical record. This document is preserved verbatim as received.
It records the *original conception* of the founding concepts; where it
conflicts with the current Foundation, the reconciliation record in
docs/reviews/ governs.

---

# 1. GuruSeed — conceção original

## Como surgiu

**Decisão do Pilot (Hélder).**

A ideia surgiu durante a discussão sobre como introduzir **a inteligência própria do utilizador** dentro do AgentOS.

O Pilot afirmou que não queria apenas agentes "bons".

Queria conseguir **ensinar os agentes com o tipo de detalhe que apenas ele conhece**, preservando essa experiência para reutilização futura.

Foi nesta altura que apareceu espontaneamente o nome:

> **GuruSeed**

O próprio Pilot descreveu o momento como uma ideia que lhe surgiu "a 300%", dizendo inclusivamente que sentiu "estalidos nas maçãs do rosto" quando o nome apareceu.

Na altura a ideia não era apenas um nome.

Era:

> pequenas unidades reutilizáveis de experiência humana.

## Problema que resolvia

Os modelos atuais obrigam o utilizador a repetir continuamente a mesma forma de pensar.

Mesmo quando um utilizador desenvolve uma excelente heurística ou abordagem, ela perde-se entre sessões.

Objetivo original:

> transformar experiência humana em conhecimento reutilizável.

## Anatomia prevista

Não foi completamente especificada. O que foi discutido explicitamente — um GuruSeed deveria conter algo próximo de:

- intenção
- domínio
- conhecimento humano
- contexto de aplicação
- explicação
- possibilidade de refinamento
- histórico

Campos concretos como JSON nunca chegaram a ser definidos.

## Granularidade

Nunca definida formalmente. A ideia implícita: suficientemente pequeno para representar uma heurística; suficientemente rico para explicar uma decisão. Nunca pensado como documento longo, nem obrigatoriamente uma única frase.

## Exemplos discutidos (implícitos)

1. "Em filmes, criar tensão emocional antes da revelação."
2. "Antes de aumentar complexidade arquitetural, tentar remover uma abstração."
3. "Quando existirem duas soluções equivalentes, escolher a que preserva conhecimento reutilizável." *(nasceu claramente da filosofia do Pilot)*

## UX imaginada

O Pilot imaginou uma UI onde pudesse fazer algo como:

```
Inject Seed
Target: Movie Mentor
Text: "Em cenas emocionais, privilegiar silêncio antes do diálogo."
```

O sistema faria: interpretar → estruturar → pedir confirmação → guardar → versionar. O utilizador nunca teria de escrever formatos específicos.

## Ciclo de vida discutido (não formalizado)

Idea → Draft → Candidate → Approved → Core → Deprecated → Archived

## GuruSeed vs InjectSeed (original)

GuruSeed = o conhecimento. InjectSeed = a ferramenta utilizada para **ensinar** esse conhecimento. (Mais tarde a resolução em runtime evoluiu para Seed Resolver.)

# 2. Executive Mode — conceção original

"O modo CEO." O utilizador não trabalha diretamente; governa. A IA trabalha e apresenta: progresso, problemas, sugestões, decisões. O Pilot escolhe.

Fluxo imaginado: Project Summary → Open Decisions → Recommendations → Approve / Reject / Refine. Surgiu também a ideia de um **Health Check** com indicadores.

# 3. Project State — intenção original

Muito diferente de memória. Project State = o estado **vivo** de um projeto (presente). Memory = conhecimento histórico (passado). Estrutura imaginada (nunca fechada): missão, objetivo atual, artefactos, decisões, próximos passos, perguntas abertas, estado.

# 4. Mentor Expertises — a decisão contra personas

Personas foram rejeitadas porque misturam identidade com competência. Mentor = quem orienta; Expertise = em que área possui conhecimento. Um mesmo Mentor pode possuir várias Expertises — como uma pessoa pode ser excelente em filmes, firmware e negócio sem ser três personas.

# 5. Autoria e ideias não registadas

- **GuruSeed**: nome criado pelo Pilot.
- **AgentOS Lab**: ideia do Pilot.
- **Navigation**: ideia conjunta; "conversa infinita entre Pilot e Copilot" defendida pelo Pilot. CURRENT + ficheiros mensais: decisão conjunta.
- **Constitution**: ChatGPT sugeriu "Constraints"; o Pilot rejeitou e propôs "Constitution", imediatamente aceite.
- **Context Scheduler**: grande hipótese arquitetural do Pilot — "hoje as LLMs reconsomem contexto; o AgentOS tenta escalonar contexto". Evoluiu para "Context is a scheduled resource".
- **Book Philosophy** (sugestão do ChatGPT): Book I Foundation · Book II Engineering · Book III Implementation · Book IV Evolution.
- **Estilo "Royal Society"** (decisão conjunta): terceira pessoa, precisa, industrial, sem hype, intemporal.
- **Não discutido / propositadamente adiado**: formato de armazenamento, algoritmo do scheduler, embeddings, vector DBs, RAG, runtime técnico.

# 6. Revision 3

Não existiu uma Foundation Revision 3 completa. Existiu uma proposta de estrutura, revisão conceptual e decisões arquiteturais. Os ficheiros completos nunca foram produzidos — o ChatGPT recusou chamar "Revision 3" a um conjunto incompleto, defendendo que uma revisão só existe quando o conjunto está consistente. Essas decisões deram origem à Foundation Revision 4.
