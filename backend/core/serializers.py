from rest_framework import serializers # Importa a classe base de serializadores do Django REST Framework (DRF)
from .models import User, Dataset, Experiment # Importa os modelos criados em models.py para serem serializados

class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializador usado para o processo de registro de um novo usuário.
    Garante que os dados enviados (email e senha) sejam validados antes de criar.
    """
    # Define explicitamente a senha, marcando como 'write_only' (para nunca ser devolvida na resposta API) e tamanho mínimo de 8 caracteres
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        # Associa este serializador ao modelo User
        model = User
        # Define os campos que a API vai aceitar para o registro
        fields = ('email', 'password')

    def create(self, validated_data):
        # Sobrescreve o método de criação para usar a função 'create_user' (definida no UserManager) que criptografa a senha adequadamente
        return User.objects.create_user(**validated_data)

class UserSerializer(serializers.ModelSerializer):
    """
    Serializador usado para devolver as informações públicas e não-sensíveis do usuário.
    """
    class Meta:
        model = User
        # Devolve apenas id, email e data de criação (nunca devolve senha ou is_staff)
        fields = ('id', 'email', 'created_at')

class DatasetSerializer(serializers.ModelSerializer):
    """
    Serializador para mostrar os detalhes completos de um Dataset.
    """
    class Meta:
        model = Dataset
        # Inclui os metadados das colunas
        fields = ('id', 'name', 'row_count', 'columns', 'created_at')

class DatasetListSerializer(serializers.ModelSerializer):
    """
    Serializador mais leve para listagem de múltiplos datasets.
    Omitimos campos grandes (como 'columns') para otimizar o tempo de resposta da API.
    """
    class Meta:
        model = Dataset
        # Retorna apenas o básico necessário para mostrar numa lista
        fields = ('id', 'name', 'row_count', 'created_at')

class ExperimentSerializer(serializers.ModelSerializer):
    """
    Serializador para mostrar os detalhes de um experimento específico (como hiperparâmetros e métricas).
    """
    # Define um campo que será calculado em tempo de execução via o método 'get_dataset_name'
    dataset_name = serializers.SerializerMethodField()

    class Meta:
        model = Experiment
        # Mostra todos os dados pertinentes ao experimento, permitindo o frontend renderizar gráficos e dados
        fields = ('id', 'name', 'model_type', 'hyperparams', 'metrics', 'dataset_name', 'created_at')

    def get_dataset_name(self, obj):
        # Lógica para preencher o campo 'dataset_name':
        # Se houver uma referência a um dataset real (obj.dataset_id), pega o nome desse dataset.
        # Caso contrário (ex: era um dataset de exemplo ou foi apagado), usa o campo de texto de backup 'dataset_name'.
        return obj.dataset.name if obj.dataset_id else obj.dataset_name

class ExperimentListSerializer(serializers.ModelSerializer):
    """
    Serializador enxuto para listagem do histórico de experimentos.
    Não retorna dicionários completos, apenas um resumo.
    """
    dataset_name = serializers.SerializerMethodField()
    # Adiciona um campo computado para resumir a métrica principal (útil para cards menores na UI)
    metrics_summary = serializers.SerializerMethodField()

    class Meta:
        model = Experiment
        # Apenas os campos básicos necessários para a lista do dashboard
        fields = ('id', 'name', 'model_type', 'dataset_name', 'metrics_summary', 'created_at')

    def get_dataset_name(self, obj):
        # Mesma lógica do ExperimentSerializer para resolver o nome do dataset
        return obj.dataset.name if obj.dataset_id else obj.dataset_name

    def get_metrics_summary(self, obj):
        # Verifica se as métricas indicam que foi uma tarefa de classificação
        if obj.metrics.get('task_type') == 'classification':
            # Para classificação, retorna apenas a acurácia no resumo
            return {'accuracy': obj.metrics.get('accuracy')}
        # Se não for classificação (ou seja, é regressão), retorna a métrica R² no resumo
        return {'r2': obj.metrics.get('r2')}