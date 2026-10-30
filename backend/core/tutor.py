import requests
import logging
from django.conf import settings

# Instancia o logger para registrar possíveis erros de comunicação com a API do Groq
logger = logging.getLogger(__name__)

def chat(messages: list[dict]) -> str:
    """
    Envia o histórico de mensagens para a IA usando a API do Groq e retorna a resposta.
    'messages' é uma lista com os diálogos anteriores no formato compatível com OpenAI/Groq.
    """
    api_key = settings.GROQ_API_KEY
    if not api_key:
        logger.error("Tentativa de chamar o Tutor de IA sem a chave GROQ_API_KEY configurada.")
        raise ValueError("GROQ_API_KEY não configurada no ambiente.")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Payload formatado conforme especificação da API da Groq
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 512
    }

    try:
        # Envia a requisição HTTP POST para a API do Groq com timeout de 30 segundos
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status() # Levanta exceção caso o status não seja 2xx
        
        response_data = response.json()
        return response_data["choices"][0]["message"]["content"]
        
    except requests.exceptions.RequestException as e:
        logger.exception("Erro ao comunicar com a API do Groq")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Corpo da resposta de erro do Groq: {e.response.text}")
        raise e
