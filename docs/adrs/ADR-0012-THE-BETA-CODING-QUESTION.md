# ADR-0012: The Beta Coding Question

**Status:** Ratified
**Date:** 2026-07-11
**Relacionado:** Artigo 5 (Context Scheduler), Artigo 6 (evidence may revise architecture), ADR-0003

## Contexto

O Beta Coding não existe para validar dez ideias. Existe para responder a UMA pergunta — a única aposta original e não-provada da arquitetura. A governança e os seeds funcionam quase por construção; o Context Scheduler é onde a tese pode genuinamente morrer. Testamos primeiro o que pode falhar.

## A Pergunta

> **Conseguimos provar que um Context Scheduler consegue reduzir contexto mantendo qualidade?**

## Parâmetros de rigor (definidos antes da primeira linha de código)

1. **Reduzir — contra o quê?**
   Baseline: full-reload do O7, medido primeiro, antes de qualquer otimização. A redução é expressa como % de tokens de contexto face a esse baseline.

2. **Qualidade — avaliada como?**
   As mesmas tarefas correm pelos dois caminhos (baseline e Scheduler). O Pilot avalia às cegas, sem saber qual output veio de qual caminho. O juízo cego do Pilot é a única métrica de qualidade que este sistema reconhece.

3. **Quantas tarefas?**
   5–10 tarefas realistas do primeiro cargo. Uma tarefa não prova nada; dez chegam para ver o padrão.

## Saídas comprometidas (antes da bola chutada)

- **"Não"** → Mudamos a arquitetura. O Artigo 6 existe exatamente para este cenário.
- **"Sim"** → Temos uma fundação muito forte para o Book II.
- **"Depende"** (resultado mais provável) → Não é falhanço; é o mapa de onde a tese vale. Registamos as condições em que o Scheduler ganha (ex.: sessões com histórico rico, tarefas de continuação) e onde perde (ex.: primeiras sessões, tarefas criativas puras). Esse mapa vale mais que um "sim" cego.

## Regra anti-baliza-móvel

Estes parâmetros e saídas ficam congelados a partir deste commit. Nenhuma parte — Pilot, Claude, Copilot ou outra — pode redefinir "reduzir", "qualidade" ou o critério de sucesso depois de os resultados começarem a chegar.

---

*Última página do Book I. A seguir: código.* ⚒️
