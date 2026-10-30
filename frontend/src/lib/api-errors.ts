import { toast } from 'sonner'

export function handleApiError(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): void {
  if (error instanceof TypeError) {
    toast.error('Sem conexão com o servidor. Verifique sua internet.')
    return
  }
  toast.error(fallback)
}

export function handleResponseError(res: Response): void {
  if (res.status >= 500) {
    toast.error('Algo deu errado. Tente novamente.')
    return
  }
  if (res.status === 429) {
    toast.warning('Muitas mensagens em pouco tempo. Aguarde um momento.')
    return
  }
}
