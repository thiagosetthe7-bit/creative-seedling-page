import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

const LINKS = [
  { to: "/", label: "CATALOGAÇÃO" },
  { to: "/sinais", label: "SINAIS" },
  { to: "/bips", label: "BIPS" },
  { to: "/dashboard", label: "DASHBOARD" },
  { to: "/simulador", label: "SIMULADOR" },
  { to: "/configuracoes", label: "CONFIGURAÇÕES" },
] as const;

function useTema() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const salvo = window.localStorage.getItem("roleta-tema");
    const isDark = salvo === "dark";
    setEscuro(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const alternar = () => {
    setEscuro((atual) => {
      const proximo = !atual;
      document.documentElement.classList.toggle("dark", proximo);
      window.localStorage.setItem("roleta-tema", proximo ? "dark" : "light");
      return proximo;
    });
  };

  return { escuro, alternar };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { escuro, alternar } = useTema();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b-2 border-[#FFD966] bg-[#111111]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2">
          <span className="mr-2 text-sm font-black tracking-widest text-[#FFD966]">
            FERRAMENTA · ROLETA
          </span>
          <nav className="flex flex-wrap gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-sm border border-transparent px-3 py-1.5 text-[11px] font-bold tracking-wide text-white/70 transition-colors hover:border-[#FFD966]/40 hover:text-white"
                activeProps={{ className: "bg-[#FFD966] text-black hover:text-black" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={alternar}
            className="ml-auto rounded-sm border border-white/25 px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10"
          >
            {escuro ? "MODO CLARO" : "MODO ESCURO"}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-4">{children}</main>
      <footer className="mx-auto max-w-[1600px] px-4 pb-8 pt-2 text-[11px] leading-relaxed text-muted-foreground">
        Ferramenta de análise estatística. Não realiza apostas, não movimenta dinheiro e não
        prevê números. Identifica apenas o padrão configurado e registra o que teria ocorrido.
      </footer>
    </div>
  );
}
