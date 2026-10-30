// URL base do nosso backend Django
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

/**
 * Função responsável por logar o usuário recebendo email e senha.
 */
export async function login(email: string, password: string): Promise<void> {
  // Manda o email e senha para o Django usando a rota pública dele
  const res = await fetch(`${API_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }), // Transforma o objeto JS em string JSON pura
  });

  // Se o backend disser "Não te conheço"
  if (res.status === 401) throw new Error("Credenciais inválidas");
  // Se o servidor cair
  if (!res.ok) throw new Error("Erro ao fazer login");

  // Pega a resposta de sucesso, que vai conter "access" e "refresh" (os Tokens)
  const data = await res.json();
  // Chama uma rota interna do Next.js para guardar isso nos Cookies do navegador de forma segura
  await setTokenCookies(data.tokens.access, data.tokens.refresh);
}

/**
 * Cria uma nova conta no banco de dados.
 */
export async function register(email: string, password: string): Promise<void> {
  // Manda os dados pro Django registrar
  const res = await fetch(`${API_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    // Tenta ler o erro em JSON que o Django mandou (ex: "Email já existe")
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? body.email?.[0] ?? "Erro ao criar conta");
  }

  // Ao criar a conta com sucesso, o backend já devolve os crachás (Tokens), então o usuário já sai logado!
  const data = await res.json();
  await setTokenCookies(data.tokens.access, data.tokens.refresh);
}

/**
 * Desloga o usuário do sistema.
 */
export async function logout(): Promise<void> {
  // O Next.js (servidor intermediário) fará o trabalho sujo de dizer pro Django botar o token na Lista Negra,
  // e depois o Next.js destruirá os cookies do navegador.
  await fetch("/api/auth/logout", { method: "POST" });
}

/**
 * Força a renovação do crachá rápido sem exigir senha de novo.
 */
export async function refreshToken(): Promise<string | null> {
  const res = await fetch("/api/auth/refresh", { method: "POST" });
  if (!res.ok) return null;
  const { access } = await res.json();
  return access;
}

/**
 * Rota auxiliar, que chama o Next.js (lado servidor seguro) para gravar os tokens como Cookies HTTP-Only.
 * Isso significa que scripts maliciosos de outras abas não podem ler a senha.
 */
async function setTokenCookies(access: string, refresh: string): Promise<void> {
  await fetch("/api/auth/set-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access, refresh }),
  });
}
