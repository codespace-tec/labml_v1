import uuid # Importa a biblioteca uuid para gerar identificadores únicos universais
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager # Importa classes base do Django para criar usuários e gerenciadores de usuários customizados
from django.db import models # Importa o módulo de banco de dados do Django, usado para definir modelos (tabelas)

class UserManager(BaseUserManager):
    """
    Gerenciador customizado para o modelo de usuário.
    Lida com a criação de usuários normais e superusuários (administradores).
    """
    def create_user(self, email, password=None, **extra):
        # Verifica se o email foi fornecido, caso contrário levanta um erro
        if not email:
            raise ValueError('Email obrigatório')
        # Cria a instância do usuário normalizando o email (transformando a parte do domínio em minúsculas) e adicionando atributos extras
        user = self.model(email=self.normalize_email(email), **extra)
        # Define a senha de forma segura (criptografada com hash)
        user.set_password(password)
        # Salva o usuário no banco de dados
        user.save(using=self._db)
        # Retorna o usuário criado
        return user

    def create_superuser(self, email, password, **extra):
        # Define os atributos padrão de um superusuário (tem acesso ao admin)
        extra.setdefault('is_staff', True)
        # Define que o usuário tem todas as permissões (é superusuário)
        extra.setdefault('is_superuser', True)
        # Chama a função create_user para efetivamente criar e salvar no banco de dados
        return self.create_user(email, password, **extra)

class User(AbstractBaseUser, PermissionsMixin):
    """
    Modelo customizado de usuário no Django.
    Substitui o username tradicional pelo uso de email como identificador.
    """
    # Define a chave primária como um UUID (identificador único universal) em vez de um número sequencial
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Define o campo de email, que deve ser único no banco de dados
    email = models.EmailField(unique=True)
    # Define se a conta está ativa (útil para "deletar" sem apagar os dados reais)
    is_active = models.BooleanField(default=True)
    # Define se o usuário tem acesso à interface de administração do Django
    is_staff = models.BooleanField(default=False)
    # Registra a data e hora em que o usuário foi criado automaticamente
    created_at = models.DateTimeField(auto_now_add=True)

    # Informa ao Django que o campo de login será o 'email', e não o 'username'
    USERNAME_FIELD = 'email'
    # Define os campos extras obrigatórios ao criar o usuário por terminal (neste caso, nenhum)
    REQUIRED_FIELDS = []
    # Associa o modelo ao nosso gerenciador customizado criado acima
    objects = UserManager()

class Dataset(models.Model):
    """
    Representa um conjunto de dados enviado por um usuário.
    Guarda as metainformações do CSV carregado.
    """
    # Identificador único do dataset usando UUID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Chave estrangeira ligando este dataset ao usuário que fez o upload. Se o usuário for deletado, os datasets dele também são (CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='datasets')
    # Nome do dataset, dado pelo usuário
    name = models.CharField(max_length=255)
    # Caminho onde o arquivo CSV foi salvo (neste caso, no Supabase Storage)
    file_path = models.CharField(max_length=500)
    # Guarda os tipos das colunas em formato JSON (ex: {"idade": "int64"})
    columns = models.JSONField(default=dict)
    # Quantidade de linhas que o dataset possui
    row_count = models.IntegerField(default=0)
    # Data de criação do dataset
    created_at = models.DateTimeField(auto_now_add=True)

class Experiment(models.Model):
    """
    Representa uma execução/treinamento de um modelo de Machine Learning.
    Salva os parâmetros usados e as métricas obtidas.
    """
    # Identificador único do experimento
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Relacionamento com o usuário que executou o experimento
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='experiments')
    # Relacionamento opcional com o dataset usado. null e blank permitem que o dataset possa ser apagado depois, ou seja um dataset de exemplo
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, null=True, blank=True, related_name='experiments')
    # Nome de backup do dataset, útil se o dataset for apagado ou for um dataset de exemplo
    dataset_name = models.CharField(max_length=255, default='')
    # Nome dado ao experimento
    name = models.CharField(max_length=255)
    # O tipo do algoritmo de ML utilizado (ex: 'linear_regression', 'decision_tree')
    model_type = models.CharField(max_length=50)
    # Armazena os hiperparâmetros que foram usados para o treinamento em formato JSON
    hyperparams = models.JSONField(default=dict)
    # Armazena os resultados e métricas de desempenho em formato JSON (ex: {"accuracy": 0.95})
    metrics = models.JSONField(default=dict)
    # Data em que o experimento foi criado/executado
    created_at = models.DateTimeField(auto_now_add=True)