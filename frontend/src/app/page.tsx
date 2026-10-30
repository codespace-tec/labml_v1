"use client"; // Esta diretiva é obrigatória no Next.js App Router para componentes que precisam rodar no navegador (pois usam botões de clique, estados, etc)

import { useState } from "react"; // Hook para criar variáveis dinâmicas que a tela 'lembra' (ex: o que foi digitado no email)
import { useRouter } from "next/navigation"; // Hook que nos dá o controle do "volante" do navegador para trocar de página
import Link from "next/link"; // Componente especial do Next para fazer links rápidos sem precisar recarregar o site inteiro
import { Brain, Loader2 } from "lucide-react"; // Ícones minimalistas SVG
import { toast } from "sonner"; // Biblioteca de notificação (aquelas caixinhas de aviso no canto da tela)
// Importa nossos componentes visuais reutilizáveis (botões e caixas de texto com estilos padrão)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth"; // Função da NOSSA biblioteca que faz o POST pro Django
import { handleApiError } from "@/lib/api-errors";

/**
 * Página principal do domínio (raiz '/'). No nosso sistema, ela funciona como a Tela de Login.
 */
export default function LoginPage() {
  const router = useRouter(); // Instancia o "volante" de navegação
  
  // Variáveis de Estado: Toda vez que setAlgumaCoisa é chamada, o React redesenha a tela com a novidade
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // Usado para mostrar o botão girando e impedir cliques duplos

  /**
   * Função engatilhada quando o usuário aperta 'Enter' ou clica no botão Entrar do Formulário.
   */
  async function handleSubmit(e: React.FormEvent) {
    // 'e.preventDefault()' impede que o navegador aja da forma padrão antiga (que era recarregar a página inteira jogando tudo na URL)
    e.preventDefault();
    setLoading(true); // Liga o modo de carregamento
    
    try {
      // Tenta acionar a nossa API que fala com o Django
      await login(email, password);
      
      // Se a promessa de login não lançar um 'throw' (Erro), significa que os cookies foram salvos!
      // Pegamos no volante e mandamos o usuário para a rota protegida
      router.push("/dashboard");
    } catch (err) {
      // Se houver erro, pode ser a internet caída ou senha incorreta
      if (err instanceof TypeError) {
        handleApiError(err);
      } else {
        toast.error("E-mail ou senha incorretos"); // Dispara o pop-up vermelho
      }
    } finally {
      // Independente de dar sucesso ou erro, desliga o ícone de carregamento ao final.
      setLoading(false);
    }
  }

  return (
    // 'min-h-screen' garante que esse fundo pegue a tela toda de altura
    // O fundo usa um gradiente radial com as cores da nossa identidade visual (via CSS nativo Tailwind)
    <div className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(ellipse_at_top,var(--color-primary-soft),transparent_60%),radial-gradient(ellipse_at_bottom_right,oklch(0.96_0.03_305),transparent_50%)]">
      
      <div className="w-full max-w-md">
        
        {/* Cabeçalho com Ícone da Mente e Título do Laboratório */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">ML Lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprenda machine learning experimentando
          </p>
        </div>

        {/* O Card (Cartão branco/escuro) contendo o formulário em si */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-7">
          <h2 className="text-base font-semibold mb-5">Entrar na conta</h2>

          {/* Tag form agrupa os inputs e intercepta a tecla "Enter" naturalmente no 'onSubmit' */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            
            {/* Bloco de E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email" // Associa o Input à Label
                type="email" // O teclado do celular vai botar o arroba (@) mais fácil
                placeholder="voce@exemplo.com"
                className="h-10"
                required
                value={email} // O que aparece aqui vem da memória React
                onChange={(e) => setEmail(e.target.value)} // Ao digitar, salva cada letra na memória
              />
            </div>
            
            {/* Bloco de Senha */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password" // Esconde os caracteres (vira bolinhas)
                placeholder="••••••••"
                className="h-10"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Botão de Submissão */}
            <Button
              type="submit"
              className="w-full h-10 bg-primary hover:bg-primary-hover"
              disabled={loading} // Congela o botão se o React estiver "pensando"
            >
              {/* Operador ternário (Condição ? Faça isso se Verdadeiro : Faça isso se Falso) */}
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}
            </Button>
          </form>

          {/* Link para quem não possui conta */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            {/* Next/Link pré-carrega a página nos bastidores para navegação ultra-rápida */}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
