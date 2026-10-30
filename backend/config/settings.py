import os # Módulo do Python para interagir com o Sistema Operacional (ler variáveis de ambiente, caminhos de pastas)
from pathlib import Path # Módulo moderno do Python para manipular caminhos de pastas de forma orientada a objetos
from dotenv import load_dotenv # Função do pacote python-dotenv para carregar o arquivo .env

# Lê o arquivo .env na raiz do projeto e joga as variáveis lá de dentro para a memória do sistema
load_dotenv()

# Caminho base do projeto. Funciona subindo duas pastas a partir deste arquivo (settings.py -> config -> backend)
BASE_DIR = Path(__file__).resolve().parent.parent

# Chave secreta criptográfica do Django. Usada para assinar senhas e sessões. NUNCA exponha ela em público!
SECRET_KEY = os.getenv('SECRET_KEY')

# DEBUG=True liga a tela amarela de erro detalhado do Django. NUNCA deixe como True em Produção, pois vaza dados do servidor!
DEBUG = os.getenv('DEBUG', 'False') == 'True'

# Lista de domínios/URLs que têm permissão para acessar este backend. (ex: localhost, seudominio.com)
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# Lista dos "Aplicativos" (módulos) ativados no projeto Django
INSTALLED_APPS = [
    # Módulos nativos do Django (Painel Administrativo, Autenticação, Sessões)
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Bibliotecas de terceiros instaladas via PIP
    'rest_framework', # O Django REST Framework (DRF) para criar APIs em formato JSON
    'rest_framework_simplejwt', # Para gerar e validar Tokens (crachás virtuais) de login
    'corsheaders', # Controla quem pode fazer requisições cross-origin (de outro domínio, como nosso Frontend no :3000)
    
    # O nosso aplicativo principal do Lab-ML, criado dentro da pasta 'core'
    'core',
    
    # Módulo extra do JWT para guardar uma "Lista Negra" de tokens bloqueados (usado no logout)
    'rest_framework_simplejwt.token_blacklist',
]

# Middlewares são "porteiros" que inspecionam a requisição ANTES dela chegar nas Views
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Permite requisições do Frontend (DEVE VIR PRIMEIRO)
    'django.middleware.security.SecurityMiddleware', # Proteções extras de segurança HTTP
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware', # Proteção contra ataques CSRF
    'django.contrib.auth.middleware.AuthenticationMiddleware', # Injeta o request.user logado
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Aponta onde o Django deve procurar pelas rotas globais do sistema
ROOT_URLCONF = 'config.urls'

# Configuração para o servidor de produção (como o Gunicorn) rodar a aplicação
WSGI_APPLICATION = 'config.wsgi.application'

# Configuração do motor de visualização HTML interno do Django (embora usemos mais JSON/API aqui)
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# Configurações de conexão com o Banco de Dados (Supabase/PostgreSQL)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql', # Usa o motor oficial do Postgres
        'NAME': os.getenv('SUPABASE_DB_NAME'), # Nome do banco
        'USER': os.getenv('SUPABASE_DB_USER'), # Usuário
        'PASSWORD': os.getenv('SUPABASE_DB_PASSWORD'), # Senha forte
        'HOST': os.getenv('SUPABASE_DB_HOST'), # URL do servidor Supabase (Pooler)
        'PORT': os.getenv('SUPABASE_DB_PORT', '6543'), # Porta de conexão
        'OPTIONS': {'sslmode': 'require'}, # Força que a comunicação pela internet seja criptografada
    }
}

# Sobrescreve o modelo tradicional de usuário do Django com o nosso customizado, que usa Email no lugar de Username
AUTH_USER_MODEL = 'core.User'

# Configurações principais do Django REST Framework (APIs)
REST_FRAMEWORK = {
    # Define que as APIs do sistema só usarão Tokens JWT para saber quem está acessando
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # Define que, por padrão, se você não especificar o contrário, a rota é bloqueada para não-logados (IsAuthenticated)
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

from datetime import timedelta
# Configura a validade dos crachás de acesso (Tokens)
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60), # Token de Acesso (rápido): Dura apenas 1 hora para evitar invasões prolongadas
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),    # Token de Renovação (lento): Dura 7 dias, serve para o frontend gerar novos Access Tokens sem pedir a senha toda hora
}

# Configurações de CORS (Cross-Origin Resource Sharing)
# Dizemos ao backend quais endereços de front-ends podem "ligar" pra cá. Impede que sites hackers façam requisições na nossa API.
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',') if o.strip()]
CORS_ALLOWED_ORIGIN_REGEXES = [r.strip() for r in os.getenv('CORS_ALLOWED_ORIGIN_REGEXES', '').split(',') if r.strip()]
# Permite que o frontend envie os "cookies" de requisição
CORS_ALLOW_CREDENTIALS = True

# Onde ficam os arquivos estáticos padrão (CSS, JS do Admin do Django)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Credenciais lidas do .env para conectar o Python com a Nuvem de Storage do Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Variáveis do Tutor IA (Ollama/Groq)
OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'http://127.0.0.1:11434') # URL de onde o modelo da IA está rodando (local ou nuvem)
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'qwen2.5:14b') # Nome do "cérebro" de Inteligência Artificial que será carregado
OLLAMA_API_KEY = os.getenv('OLLAMA_API_KEY', '') # Chave se for um serviço pago. Vazia para o Ollama local gratuito.
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.1-8b-instant')