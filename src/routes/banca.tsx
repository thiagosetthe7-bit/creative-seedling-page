import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { GerenciadorBanca } from "@/components/roleta/GerenciadorBanca";

export const Route = createFileRoute("/banca")({
  head: () => ({
    meta: [
      { title: "Gerenciador de Banca — Recovery Smart" },
      {
        name: "description",
        content: "Gerenciador de banca com configuração guiada, stake dinâmica, recuperação segura e histórico conectado ao BIP Analyzer.",
      },
    ],
  }),
  component: Banca,
});

function Banca() {
  return (
    <AppShell>
      <GerenciadorBanca />
    </AppShell>
  );
}
