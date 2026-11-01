# Motores operacionais VOLT & DELTA

## Regras implementadas

- VOLT: avalia colunas e dúzias após uma sequência de 3 a 5 resultados iguais, uma quebra e um retorno ao valor original. A saída de VOLT cobre o setor identificado e um setor adjacente. Quando os dois eixos VOLT qualificam no mesmo giro, a matriz seleciona coluna antes de dúzia para evitar alertas duplicados.
- DELTA: exige pelo menos cinco resultados consecutivos no mesmo eixo binário, uma quebra e retorno ao valor original. Eixos: cor, paridade e alto/baixo. Zero não é tratado como cor/paridade/altura válida e os giros anteriores ao zero mais recente não completam a sequência.
- Confluência: quando VOLT e DELTA qualificam no mesmo giro, é emitido um único sinal VOLT + DELTA. O resultado de uma entrada combinada só é GREEN se o giro satisfizer o alvo VOLT e o alvo DELTA.
- Recuperação: o acompanhamento automático permite R1 e apenas Gale 1 (R2). R1 errado avança para Gale 1; Gale 1 errado fecha em RED. Não há fase automática Gale 2.
- Histórico e finanças: resultados pendentes, “Não Peguei” e bloqueados não geram lucro nem prejuízo. O Stop Loss de referência é calculado como percentual configurável da banca inicial e não deve impedir a transição de R1 para Gale 1.
- Risco visual e backtest: a tela de gerenciamento de banca contém indicador de risco estável/crítico/stop loss; a aba de backtest aceita até 100 pares de número e horário.

## Cobertura matemática teórica

Na roleta europeia (37 resultados igualmente possíveis), dois grupos de 12 números cobrem 24/37 = 64,86% dos resultados em um giro, antes de considerar regras de pagamento e a casa. Uma chance simples cobre 18/37 = 48,65%. Essas são probabilidades teóricas de um giro, não métricas de assertividade observada.

## Métricas não presumidas

Não são codificadas como garantias as taxas de 90%, 95%, 98% ou 100% descritas em material operacional. Para sustentar uma taxa empírica, é necessário um backtest reproduzível com amostra suficiente, regras de liquidação definidas, resultados fora da amostra e registro de todas as entradas, inclusive perdas. Padrões históricos não garantem resultados futuros.
