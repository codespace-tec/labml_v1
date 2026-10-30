// Define a URL base do backend (Django). Pega das variáveis de ambiente (.env.local) ou usa localhost por padrão.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

// Variável na memória do navegador (RAM) para guardar o Token de Acesso (Crachá rápido) temporariamente.
// É mais seguro deixar na memória do que no LocalStorage, pois evita ataques de roubo de scripts (XSS).
let cachedToken: string | null = null;

/**
 * Função interna que "bate" na rota segura do Next.js (Next.js API route)
 * para pegar um Token de Acesso novinho em folha, usando o Refresh Token que está escondido nos Cookies HTTP-Only.
 */
async function fetchToken(): Promise<string | null> {
  // Dispara um POST silencioso pro próprio servidor frontend do Next.js
  const res = await fetch("/api/auth/refresh", { method: "POST" });
  if (!res.ok) return null; // Se falhar (ex: expirou os 7 dias), retorna nulo

  const { access } = await res.json();
  // Guarda na memória RAM
  cachedToken = access;
  return access;
}

/**
 * Invalida/limpa o crachá atual da memória, forçando o sistema a pedir um novo na próxima vez.
 */
export function invalidateToken(): void {
  cachedToken = null;
}

/**
 * Uma versão "turbinada" da função padrão 'fetch' do JavaScript.
 * Ela cuida automaticamente de injetar o 'Token de Acesso' nas requisições 
 * e, se o token estiver vencido (Erro 401), ela tenta renová-lo sozinha.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  // Pega da RAM ou faz o esforço de buscar um novo no backend
  const token = cachedToken ?? (await fetchToken());

  // Monta o "envelope" HTTP (Headers) e anexa o crachá na frente: "Bearer <token>"
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Faz o pedido real ao Backend Django (Ex: GET /api/datasets)
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  // Status 401 = Não Autorizado (Geralmente porque o Access Token de 1h de duração venceu)
  if (res.status === 401) {
    invalidateToken(); // Apaga o vencido da memória
    const newToken = await fetchToken(); // Tenta pegar um novo silenciosamente

    if (!newToken) {
      // Se não conseguiu um novo, significa que o usuário ficou muito tempo fora e precisa relogar com senha
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/"; // Redireciona pra página inicial (Login)
      return res;
    }

    // Se conseguiu um Token novo, remonta o envelope com o token novinho
    const retryHeaders = new Headers(init.headers);
    retryHeaders.set("Authorization", `Bearer ${newToken}`);
    // Tenta fazer o pedido ao Django UMA SEGUNDA VEZ, e desta vez deve funcionar
    return fetch(`${API_URL}${path}`, { ...init, headers: retryHeaders });
  }

  // Retorna a resposta (se deu certo de primeira, ou se deu outros erros como 404, 500, etc)
  return res;
}
