import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { BankrollPanel } from "@/components/roleta/BankrollPanel";

export const Route = createFileRoute("/banca")({
  head: () => ({
    meta: [
      { title: "Gerenciamento de Banca — Roleta" },
      { name: "description", content: "Controle de banca, metas, stakes e limites de sessão." },
    ],
  }),
  component: Banca,
});

function Banca() {
  return <AppShell><BankrollPanel /></AppShell>;
}
