import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/novo-projeto")({
  head: () => ({
    meta: [
      { title: "Novo projeto" },
      { name: "description", content: "Página em branco para novo projeto." },
      { property: "og:title", content: "Novo projeto" },
      { property: "og:description", content: "Página em branco para novo projeto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovoProjeto,
});

function NovoProjeto() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-2xl font-semibold text-foreground">Novo projeto</h1>
    </main>
  );
}
