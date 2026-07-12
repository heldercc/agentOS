# Parecer — GPT (mão arquitetural do Piloto), 2026-07-12 ~18:51–18:56

Recebido do Piloto durante o primeiro teste humano estendido. Dois blocos de
apêndice, transcritos verbatim, seguidos das notas de execução do worker.
Contexto reportado pelo Piloto: alguns destes pontos são pedidos **pela
segunda vez** — em particular as métricas de tempo durante chamadas ao Claude
Code. Diagnóstico do worker: a reforma (`3f9638b`) implementou o cronómetro,
mas o processo live :4900 era anterior ao restart e o browser do Piloto ainda
servia a página antiga — exatamente a falha de visibilidade de versão que o
bloco B deste parecer descreve. O sintoma confirma o defeito.

O apêndice acumulado do GPT (para a prompt consolidada futura) contém ainda,
por título: Project Review obrigatório no fecho; resultado humano como
evidência real; evolução governada dos Senseis; seleção separada de
competência validada; "Levar para Decidir — quero opções"; três perguntas
coerentes por submissão; reconsulta agregada, uma vez por agente; contenção
do crescimento infinito da entrevista; Mode Edit acordado e agendado. Esses
blocos chegarão como prompt consolidada; os dois abaixo chegaram já e são
executados agora.

---

## Bloco 1 — TEST-CONDITION DISCLOSURE (verbatim)

```
TEST-CONDITION DISCLOSURE — LIGHTEST MODEL

The current human test is deliberately running on the lightest available model:

- runtime: cli;
- worker model: haiku;
- effort: low.

Preserve this condition in every test report and metric.

Do not generalize a result without distinguishing:

1. Product/architecture failure;
2. Likely model-capability limitation;
3. Interaction between model capability and Kernel mechanism;
4. Unknown cause requiring an A/B test.

The light model is a useful stress test.

The Kernel must remain safe and governable even when the worker model:

- asks weak questions;
- produces semantic duplicates;
- fails to recognize sufficient context;
- returns malformed output;
- over-interviews;
- produces shallow options.

A weaker model may reduce output quality.

It must not be able to create unbounded governance burden.

For the runaway interview finding:

- haiku/low may contribute to poor question judgment;
- unlimited reconsult-driven question growth remains a Kernel defect;
- the test report must record both.

Later run a controlled comparison on the same brief:

A. haiku / low;
B. stronger model / comparable workflow.

Keep constant:

- founding intent;
- question-burden rules;
- option count;
- interaction path where possible;
- Pilot acceptance rubric.

Compare:

- questions proposed;
- questions surfaced;
- semantic duplicates;
- reconsult growth;
- Work Orders;
- time;
- exact/estimated tokens;
- final Project Review;
- Artifact quality;
- cost per accepted result.

Do not silently solve architectural failures by upgrading the model.

The desired result is:

- cheap model for bounded mechanical work;
- stronger model only where measured value justifies it;
- Kernel constraints protecting the Pilot under every model.
```

## Bloco 2 — LIVE EXECUTION OBSERVABILITY (verbatim)

```
LIVE EXECUTION OBSERVABILITY — THE APP MUST NEVER LOOK FROZEN

The Pilot reports that, while Claude Code is working, the App still shows no
useful live time/progress metrics.

It appears stopped.

This is a product defect even when the underlying process is healthy.

There are two distinct problems to solve:

1. stale-runtime visibility;
2. in-flight Work Order visibility.

A. RUNNING VERSION MUST BE VISIBLE

The live :4900 instance may still be running code older than origin/main.

The App must display in Details/Audit:

- application build/commit SHA;
- process start time;
- runtime name;
- application version;
- data/schema version;
- migration version;
- port;
- whether the current process predates the latest checked-out code.

At minimum, the header or Audit view must make this statement possible:

“Running AgentOS build: 3f9638b”
“Process started: 17:02”
“Repository HEAD at launch: e2fd892”

Never let the Pilot believe a committed feature is active when the process has
not been restarted.

When the process is known to be stale, display:

“Há código mais recente no repositório. Esta App continua a executar a versão
iniciada às HH:MM.”

Do not auto-restart a live Pilot project.

Restart remains an explicit operational action with safe-state checks.

B. LIVE OPERATION CARD

The moment an operation starts, show a live card containing:

- human operation name;
- internal operation kind;
- phase;
- current Work Order ID;
- current temporary role;
- model;
- effort level;
- operation start time;
- elapsed wall-clock time, ticking every second;
- Work Orders completed / total planned;
- current status;
- last heartbeat/activity;
- timeout or deadline;
- tokens completed so far;
- whether token counts are exact or estimated.

Example:

O SISTEMA ESTÁ A TRABALHAR

A compreender a tua resposta
Work Order 2 de 3
Papel: Guardião da Jornada Criança
Modelo: haiku · esforço low

Tempo decorrido: 01:42
Última atividade: há 3s
Tokens concluídos: 4 820 estimados

A aguardar resposta do Claude Code.
Os tokens desta chamada aparecem quando ela terminar.

C. HONEST TOKEN VISIBILITY

The Claude Code CLI port currently estimates usage after a call completes.

Do not pretend tokens are streaming when they are not.

During the in-flight call show:

“Tokens desta chamada: disponíveis após conclusão.”

Continue showing:

- tokens from completed Work Orders;
- estimated calls remaining;
- projected total from the Effort Probe;
- operation elapsed time.

After completion, replace the pending message with:

- input tokens;
- output tokens;
- total;
- exact/estimated status;
- model duration;
- estimate-versus-actual difference.

D. HEARTBEAT AND EXECUTION STATES

Represent the operation through explicit states:

queued
→ launching Claude Code
→ awaiting model
→ response received
→ validating/parsing
→ persisting Artifact/evidence
→ completed

Persist or expose a lightweight heartbeat so the App can distinguish:

- working normally;
- no recent heartbeat;
- process exited;
- timed out;
- response received but parsing failed;
- persistence failed.

Do not display a fake percentage.

A stage label and elapsed time are more honest than invented progress.

E. PILOT CONTROL

The Pilot must be able to halt an in-flight operation.

Add a governed action:

“Parar esta operação”

Stopping must:

- terminate only the current child process;
- preserve every already completed Work Order;
- mark the interrupted Work Order honestly;
- emit an operation_cancelled event, actor Pilot;
- leave the project consistent and resumable;
- never discard prior answers or decisions;
- present Retry / Continue / Change effort.

F. POLLING AND FAILURE VISIBILITY

If state polling fails, do not silently swallow the error forever.

The current UI must not keep showing an old screen while communication with the
server has stopped.

Show a non-destructive status:

“Ligação à App interrompida — última atualização há 18s.”

Retry automatically, while preserving the user's unsent text.

G. METRICS

Record:

- operation wall-clock duration;
- Claude/model duration;
- queue time;
- parsing/persistence time;
- heartbeat gaps;
- cancellation;
- timeout;
- retries;
- completed versus interrupted Work Orders;
- time spent with no visible state update.

Add “time to first visible feedback” as a product metric.

H. TESTS

Verify in the browser with a deliberately slow fake runtime:

1. timer appears immediately;
2. it ticks without waiting for Work Order completion;
3. current model/role/Work Order are visible;
4. token status says pending honestly;
5. completed Work Orders update the token total;
6. heartbeat changes;
7. cancellation leaves the project consistent;
8. timeout is visible;
9. polling failure is visible;
10. build SHA and process start time are visible;
11. no user text is lost during polling/render updates.

Acceptance:

At no point may the Pilot reasonably wonder:

“Está a trabalhar, bloqueou ou morreu?”
```

---

## Notas de execução (worker, mesma noite)

Ordem de trabalho aceite na íntegra. Decisões de implementação:

1. **Sem tocar no Kernel para o progresso**: o shell instrumenta o `Runtime`
   com um decorator por operação — fases `launching → awaiting model →
   response received → processing` derivam das chamadas reais; heartbeat vem
   dos chunks de stdout/stderr do child process (porta cli). Honesto por
   construção: nenhuma percentagem inventada.
2. **Versão visível**: SHA e HEAD capturados no arranque via `git rev-parse`;
   staleness verificada contra o HEAD atual do repo (cache 30s) e mostrada
   com a frase exata pedida no bloco A. Sem auto-restart — permanece ato
   operacional explícito.
3. **Cancelamento**: `AbortSignal` por operação; a porta cli mata apenas o
   child process; work orders completos ficam; evento `operation_cancelled`
   com actor pilot; `lastError` distingue cancelamento de falha.
4. **Test-condition disclosure**: o extrator de métricas passa a abrir com o
   bloco de condições (runtime, modelos e níveis reais por work order) e a
   contagem de cancelamentos/timeouts; nenhum relatório sai sem a condição.
5. **A/B haiku vs modelo mais forte**: fica no roadmap (item 3 já existente —
   baseline comparison), agora com a rubrica de comparação deste parecer.

Conformidade ADR-0020 §8: mecanismo, não conteúdo; o Piloto governa
(cancelar é ato dele, restart é ato dele); evidência em eventos append-only;
efémero descartável (busy state morre com o processo); reforça a Foundation
(ver sem adivinhar).
