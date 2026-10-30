"use client"; // Esta diretiva diz ao Next.js que este componente usa coisas que só existem no navegador do usuário (como useState e onClick)

import Link from "next/link"; // Componente nativo do Next.js para fazer navegação rápida sem recarregar a página inteira
import { usePathname, useRouter } from "next/navigation"; // Hooks para descobrir a URL atual ou forçar mudança de página
import { useState } from "react"; // Hook básico do React para guardar o "estado" (memória) das coisas na tela
// Importa os ícones do pacote Lucide
import {
  LayoutDashboard,
  Database,
  Plus,
  ChevronLeft,
  Brain,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils"; // Utilitário para juntar classes do Tailwind sem conflitos
import { useTheme } from "@/hooks/use-theme"; // Nosso hook customizado para alternar Tema Claro/Escuro
import { logout } from "@/lib/auth"; // Função da nossa biblioteca para deslogar do backend

// Menu lateral de navegação definido como uma lista simples para facilitar adição de novos links
const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/experiments/new", label: "Novo Experimento", icon: Plus, accent: true },
];

/**
 * AppShell é a "Casca" do site.
 * Ele engloba todo o conteúdo principal, adicionando o Menu Lateral (Sidebar) e o Cabeçalho Superior (Header) fixos.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  // useState guarda se o menu lateral está encolhido (collapsed) ou não
  const [collapsed, setCollapsed] = useState(false);
  // useState guarda se o menu mobile (celular) está aberto na tela
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // hook para pegar a URL da barra de endereços (ex: '/dashboard')
  const pathname = usePathname();
  // hook para disparar navegação forçada via código
  const router = useRouter();
  // Pega o tema atual (dark/light) e a função de mudar de tema
  const { theme, toggleTheme } = useTheme();

  // Função disparada ao clicar no botão Sair
  async function handleLogout() {
    await logout(); // Limpa os cookies no backend
    router.push("/"); // Expulsa o usuário de volta pra tela de login
  }

  // Subcomponente interno para desenhar os links de navegação. 
  // O 'onNavigate' serve para, no celular, o menu se fechar automaticamente logo após clicar num link.
  const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 px-2 py-4 space-y-1 relative z-10">
      {nav.map((item) => {
        // Lógica para descobrir se o link que estamos renderizando é a página que o usuário está agora
        const active =
          pathname === item.to ||
          (item.to !== "/dashboard" && pathname.startsWith(item.to));
        const Icon = item.icon;
        
        return (
          <Link
            key={item.to}
            href={item.to}
            onClick={onNavigate}
            // O 'cn' junta classes padrão de tamanho com condicionais (cores diferentes se for 'active')
            className={cn(
              "flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-active text-white" // Se for a página atual, fica destacado
                : "text-sidebar-foreground hover:bg-white/5 hover:text-white", // Se não, fica cinza com hover branco
              item.accent && !active && "text-white", // Regra especial para o botão "+ Novo Experimento" brilhar mais
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    // Um flex layout que ocupa a tela toda (min-h-screen w-full)
    <div className="flex min-h-screen w-full bg-background">
      
      {/* 1. MÁSCARA ESCURA PARA CELULAR: Quando o menu abre, o resto da tela fica escurecido */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileOpen(false)} // Se clicar fora do menu, ele fecha
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}
      
      {/* 2. MENU LATERAL FLUTUANTE (VERSÃO CELULAR) */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full z-50 flex flex-col text-sidebar-foreground border-r border-sidebar-border transition-transform duration-200 w-60 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full", // Traz pra tela se 'mobileOpen' for true, senão joga pra fora da tela à esquerda
        )}
        style={{
          backgroundImage: "var(--sidebar-gradient), var(--sidebar-glow)",
          backgroundColor: "var(--sidebar)",
        }}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="font-semibold text-white tracking-tight">ML Lab</div>
          </div>
          <button
            onClick={() => setMobileOpen(false)} // Botão de "X" (fechar)
            className="h-8 w-8 flex items-center justify-center rounded-md text-sidebar-muted hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* 3. MENU LATERAL FIXO (VERSÃO COMPUTADOR/TABLET - hidden na tela pequena) */}
      <aside
        className={cn(
          "hidden md:flex flex-col text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 relative overflow-hidden",
          collapsed ? "w-16" : "w-60", // Animação de largura entre 60px e 240px
        )}
        style={{
          backgroundImage: "var(--sidebar-gradient), var(--sidebar-glow)",
          backgroundColor: "var(--sidebar)",
        }}
      >
        {/* Enfeite de luz no fundo do menu lateral */}
        <div
          className="pointer-events-none absolute -bottom-24 -left-12 h-64 w-64 rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, oklch(0.6 0.2 320 / 0.5), transparent 70%)" }}
        />

        <div className="h-16 flex items-center gap-2 px-4 border-b border-sidebar-border relative z-10">
          <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center shrink-0 shadow-lg">
            <Brain className="h-4 w-4 text-white" />
          </div>
          {/* Se estiver encolhido, esconde o texto para deixar só a logo */}
          {!collapsed && (
            <div className="font-semibold text-white tracking-tight">ML Lab</div>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 relative z-10">
          {nav.map((item) => {
            const active =
              pathname === item.to ||
              (item.to !== "/dashboard" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                href={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-active text-white"
                    : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
                  item.accent && !active && "text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Botão para encolher/expandir o menu */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-3 h-9 flex items-center justify-center rounded-md text-sidebar-muted hover:bg-white/10 hover:text-white text-xs relative z-10"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span className="ml-2">Collapse</span>}
        </button>
      </aside>

      {/* 4. ÁREA PRINCIPAL DA PÁGINA (Header Superior + Conteúdo dinâmico) */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-navbar text-navbar-foreground flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* Ícone de "Hamburger" que aparece apenas no mobile para abrir o menu da esquerda */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Breadcrumb simples baseado na URL (Ex: ML Lab / Dashboard) */}
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">ML Lab</span>
              <span className="mx-2">/</span>
              <span className="capitalize">
                {pathname.replace("/", "") || "dashboard"}
              </span>
            </div>
          </div>
          
          {/* Botões do lado direito (Tema Escuro, Sair e Foto do usuário) */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
            <div className="h-9 w-9 rounded-full bg-primary-soft text-primary font-semibold flex items-center justify-center text-sm">
              SK
            </div>
          </div>
        </header>
        
        {/* A prop 'children' é injetada aqui. Ou seja, tudo que muda no site (o painel de controle, a lista de arquivos) é injetado dentro da tag 'main' da Casca */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
