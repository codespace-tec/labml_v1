"use client" // Permite usar 'estados' e interação de cliques no navegador

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner" // Biblioteca simples de criar "Pop-ups/Alertas" no canto da tela
import { cn } from "@/lib/utils" // Ajudante para agrupar várias classes CSS
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Define a estrutura visual de uma mensagem
interface Message {
  role: "user" | "assistant" // "user" é você, "assistant" é a IA (Ollama)
  content: string // O texto puro da mensagem
}

// Garante que o componente receberá o ID do experimento pai ao ser renderizado
interface TutorChatProps {
  experimentId: string
}

export function TutorChat({ experimentId }: TutorChatProps) {
  // Guarda as mensagens de todo o diálogo em tela
  const [messages, setMessages] = useState<Message[]>([])
  // Guarda o que está sendo digitado na barrinha no momento
  const [input, setInput] = useState("")
  // Evita que o usuário clique no botão 'Enviar' um milhão de vezes enquanto o Tutor 'pensa'
  const [isLoading, setIsLoading] = useState(false)
  // Cria uma "âncora" invisível para a tela rolar sozinha para as novas mensagens
  const bottomRef = useRef<HTMLDivElement>(null)

  // Dispara automaticamente quando a página abre, puxando a conversa. O array de dependência garante que reinicia se mudarmos de ID de Experimento.
  useEffect(() => {
    // Injeta a saudação inicial fingindo que o assistente já disse "Olá"
    setMessages([
      {
        role: "assistant",
        content:
          "Olá! Vi que você acabou de treinar um modelo. Quais foram suas primeiras impressões sobre os resultados?",
      },
    ])
  }, [experimentId])

  // Toda vez que a variável 'messages' crescer com respostas novas, isso desce a barra de rolagem suavemente (scroll)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Ação ativada quando se pressiona 'Enter' ou o botão 'Enviar'
  async function sendMessage() {
    // Não faz nada se a caixa tiver vazia ou o robô já estiver processando
    if (!input.trim() || isLoading) return

    // 1. Cria a mensagem do Usuário
    const userMessage: Message = { role: "user", content: input }
    // 2. Anexa ao histórico de conversas da tela instantaneamente, antes da requisição acabar
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    // 3. Limpa o texto da caixa preta para poder digitar de novo
    setInput("")
    // 4. Mostra bolinhas girando (...)
    setIsLoading(true)

    // Tenta conversar com a internet
    try {
      const res = await fetch("/api/chat", {
        method: "POST", // Mandar informações ocultas seguras
        headers: { "Content-Type": "application/json" },
        // Envia TODOS os diálogos e o UUID do experimento
        body: JSON.stringify({
          experiment_id: experimentId,
          messages: newMessages,
        }),
      })
      const data = await res.json()
      // O Django devolve o 'error' formatado ou o 'reply'
      if (res.status === 429) {
        toast.warning("Muitas mensagens em pouco tempo. Aguarde um momento.")
        return
      }
      if (!res.ok) throw new Error(data.error)

      // Se foi sucesso, adiciona o que a IA pensou na tela (atualizando a variável messages)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ])
    } catch (err) {
      if (err instanceof TypeError) {
        toast.error("Sem conexão com o servidor. Verifique sua internet.")
      } else {
        toast.error("Tutor indisponível. Tente novamente.")
      }
    } finally {
      setIsLoading(false) // Acabou tudo, para as bolinhas giratórias e libera a barrinha pra digitar de novo
    }
  }

  return (
    <aside className="flex flex-col h-full border-l">
      {/* Cabeçalho Fixo do chat */}
      <div className="p-4 border-b font-semibold">Tutor de IA</div>

      {/* Janela esticável de mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Gera as famosas 'bolhas' visuais a partir da nossa lista de Javascript */}
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}
        {/* Exibe o indicador (...) apenas enquanto 'isLoading' for True */}
        {isLoading && <TypingIndicator />}
        {/* Âncora invisível que puxa o Scroll pra baixo */}
        <div ref={bottomRef} />
      </div>

      {/* Caixa Inferior Fixo de Escrever */}
      <div className="p-4 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          // Se apertar a tecla "Enter" sem apertar o botão "Shift" junto, envia o email. 
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Pergunte ao tutor..."
          disabled={isLoading} // Trava pra não mexer se estiver pensando
        />
        <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
          Enviar
        </Button>
      </div>
    </aside>
  )
}

/**
 * COMPONENTE SECUNDÁRIO E INTERNO
 * Apenas cuida de aplicar cores e posições se a mensagem é sua (direita/roxo) ou da IA (esquerda/cinza).
 */
function ChatBubble({
  role,
  content,
}: {
  role: "user" | "assistant"
  content: string
}) {
  const isUser = role === "user"
  return (
    // Usa um container invisível flexível. Se for você (isUser), ele 'empurra' (justify-end) o balão pra direita da tela
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground" // Cores vibrantes
            : "bg-muted text-muted-foreground", // Cores opacas
        )}
      >
        {content}
      </div>
    </div>
  )
}

/**
 * COMPONENTE VISUAL SECUNDÁRIO
 * Apenas aquelas 3 bolinhas clássicas que ficam pulando de forma animada (via Tailwind animado)
 */
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-lg px-3 py-2">
        <span className="flex gap-1">
          {/* As bolinhas têm delays (atrasos) diferentes para não pularem juntas, criando o efeito de "onda" */}
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  )
}
