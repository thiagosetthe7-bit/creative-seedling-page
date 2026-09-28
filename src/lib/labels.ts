export const rotuloAlerta = (a: { estrategia: string }) => a.estrategia;
export const linhaEntrada = (a: { entrada: string }) =>
  "ENTRADA: " + a.entrada.replace(/^(ENTRAR EM|ENTRADA:)\s*/i, "");
