"use client"; // Permite que a página utilize lógicas dinâmicas no navegador (estados e interatividade)

import { useState } from "react";
import { useRouter } from "next/navigation"; // Ferramenta do Next para redirecionar usuários por código
import Link from "next/link";
import { Brain, Loader2 } from "lucide-react"; // Bibliotecas de SVGs práticos
import { toast } from "sonner"; // Permite que surjam alertas bonitos no canto da tela (Pop-ups)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/lib/auth"; // NOSSA função para contatar o back-end (em api.ts)
import { handleApiError } from "@/lib/api-errors";

/**
 * Página acessada via rota `/register`. Tela para criação de novos usuários.
 */
export default function RegisterPage() {
  const router = useRouter();
  
  // Declara variáveis de Estado que o React ficará monitorando
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Aqui guardamos textos de erros de Validação Front-End (Ex: "Senha Curta Demais")
  const [error, setError] = useState<string | null>(null);
  
  // Estado que avisa se a aplicação está esperando a resposta do Servidor
  const [loading, setLoading] = useState(false);

  // É disparada quando o usuário confirma o formulário HTML
  async function handleSubmit(e: React.FormEvent) {
    // Quebra o comportamento padrão do HTML5 de atualizar a aba inteira
    e.preventDefault();
    
    // Limpa a lousa de erros a cada nova tentativa
    setError(null);

    // Validações simples de lógica no lado do Frontend antes de incomodar o servidor 
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return; // O return isolado mata a função aqui, ou seja, aborta.
    }
    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres");
      return;
    }

    setLoading(true); // Tudo parece ok, hora de sinalizar que começou o processo de servidor.
    
    try {
      // Chama o nosso método de API que, se der certo, automaticamente logará a pessoa e guardará os cookies de Token.
      await register(email, password);
      // Redireciona para área de testes, já que a pessoa agora tem os cookies de segurança instalados
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof TypeError) {
        handleApiError(err);
      } else {
        toast.error("E-mail já está em uso"); // Backend deve ter gritado de volta sobre unicidade de e-mail
      }
    } finally {
      // O bloco 'finally' OBRIGATORIAMENTE roda, mesmo se o 'try' falhar e entrar no 'catch'.
      // Portanto, é o lugar ideal para desabilitar as animações de carregamento sem duplicar código.
      setLoading(false);
    }
  }

  return (
    // Esse super background usa as cores globais de Tailwind, desenhando gradientes ovais
    <div className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(ellipse_at_top,var(--color-primary-soft),transparent_60%),radial-gradient(ellipse_at_bottom_right,oklch(0.96_0.03_305),transparent_50%)]">
      <div className="w-full max-w-md">
        
        {/* Cabeçalho Visual da Página */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">ML Lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprenda machine learning experimentando
          </p>
        </div>

        {/* Container que envolve o formulário (card branco) */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-7">
          <h2 className="text-base font-semibold mb-5">Criar conta</h2>

          <form className="space-y-4" onSubmit={handleSubmit}>
            
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@exemplo.com"
                className="h-10"
                required
                value={email} // Vincula a caixa à nossa variável React
                onChange={(e) => setEmail(e.target.value)} // Vincula atualizações
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="h-10"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password" // Protege dos espiões
                placeholder="••••••••"
                className="h-10"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {/* Renderização Condicional: Só vai aparecer na tela caso a variável 'error' contenha alguma string vermelha */}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* O Botão Final */}
            <Button
              type="submit"
              className="w-full h-10 bg-primary hover:bg-primary-hover"
              disabled={loading} // Não permite duplos-cliques perigosos e custosos
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando conta...</> : "Criar conta"}
            </Button>
          </form>

          {/* Redirecionamento gentil (Fallback) */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            {/* Direciona para a raiz que abriga o formulário de login */}
            <Link href="/" className="text-primary hover:underline font-medium">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
