# Reset da Engine de Sinais e Estratégias

**Estado: TÁBULA RASA — aguardando nova especificação.**

A engine foi colocada em estado inativo. Regras de entrada/saída, thresholds, filtros, indicadores de estratégia, prioridade VOLT/DELTA, lógica de progressão, reentrada, recuperação e geração de alertas anteriores não são executados.

- `signalEngine.ts` conserva apenas contratos de tipos e funções de compatibilidade que retornam nenhum sinal.
- O acompanhamento de sinais não reconstrói resultados antigos.
- O cache local `roleta-signal-tracking-v1` é removido no carregamento.
- A interface de catalogação não mostra o modal nem o painel de sinais.
- Giros catalogados e livro-razão financeiro geral são preservados; o reset não apaga o histórico bruto nem dados financeiros fora do cache da engine.
- Catalogação e backtest permanecem disponíveis, mas não há geração automática de sinais até uma nova especificação.

Nenhuma regra anterior deve ser considerada ativa.
