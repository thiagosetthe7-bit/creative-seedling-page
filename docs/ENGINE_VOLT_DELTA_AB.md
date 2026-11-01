# Engine VOLT A/B + DELTA A/B

## Parâmetros
- Janela bruta de análise: 30 giros.
- Acumulação mínima: 5 registros válidos.
- Zero neutro: permanece no histórico e é ignorado pela sequência e pelo contador de acumulação.
- VOLT A: acumulação em exatamente duas áreas de dúzia/coluna, uma quebra fora do par e retorno ao par.
- VOLT B: acumulação em exatamente duas áreas, duas quebras consecutivas fora do par e retorno.
- DELTA A/B: acumulação exata numa categoria, uma ou duas quebras e retorno à categoria.
- Confluência no mesmo giro: VOLT + DELTA é emitido como sinal unificado, em vez dos sinais-base isolados.
- Popup premium: glassmorphism, alvo, ação, justificativa, contador de 15 segundos e botão de fechar.

## Observação
Os padrões são regras determinísticas de leitura do histórico, não garantias de previsão ou de lucro. A probabilidade de cada giro de roleta permanece independente sob condições normais.
