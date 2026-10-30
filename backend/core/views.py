from uuid import uuid4 # Para gerar códigos/ID únicos globais (UUID)
import logging # Para registrar avisos ou erros no servidor (logs)
import math # Para checar NaN/Inf em tipos primitivos Python
import threading # Para rodar tarefas demoradas em "segundo plano" simultaneamente
import pandas as pd # Para tratar os dados/tabelas no backend

# Instancia o registrador de logs com o nome do arquivo atual
logger = logging.getLogger(__name__)

from rest_framework import status # Códigos HTTP padrão (200 OK, 404 NOT FOUND, 500 SERVER ERROR)
from rest_framework.decorators import api_view, permission_classes # Modificadores para transformar uma função numa rota de API
from rest_framework.exceptions import ValidationError # Exceção especial para barrar dados mal-formatados que o usuário manda
from rest_framework.permissions import AllowAny, IsAuthenticated # Controladores de quem pode acessar cada rota (Visitante vs Logado)
from rest_framework.response import Response # Objeto padrão para devolver JSON (textos) ao frontend
from rest_framework.views import APIView # Classe base para construir rotas agrupadas
from rest_framework_simplejwt.tokens import RefreshToken # Manipulador de tokens de login
from .models import Dataset, Experiment # Nossos modelos do Banco de Dados
from .serializers import ( # Importa como "traduzir" dados Python para JSON para a Web
    RegisterSerializer, UserSerializer,
    DatasetSerializer, DatasetListSerializer,
    ExperimentSerializer, ExperimentListSerializer,
)
from .storage import upload_csv, download_csv_as_dataframe # Integrações de Nuvem (Supabase)
from . import ml_engine # Nosso cérebro de Machine Learning
from .tutor import chat # O módulo para conversar com o Ollama
from .prompt_builder import build_system_prompt # Montador da inteligência do Tutor

# -------------------------------------------------------------
# ROTAS DE AUTENTICAÇÃO
# -------------------------------------------------------------

@api_view(['POST']) # Diz ao Django que esta função é uma API acessível pelo método HTTP POST
@permission_classes([AllowAny]) # Qualquer pessoa, mesmo sem login, pode criar uma conta
def register(request):
    """Rota para registrar novo usuário e devolver o primeiro token de login."""
    # Pega os dados JSON e tenta construir os objetos validando email e tamanho de senha
    serializer = RegisterSerializer(data=request.data)
    # Se os dados forem inválidos (ex: sem arroba), levanta exceção na hora parando a requisição e devolvendo erro 400
    serializer.is_valid(raise_exception=True)
    # Efetiva o salvamento no banco de dados e ganha de volta a cópia real do usuário criado
    user = serializer.save()
    # Pede à biblioteca do JWT para forjar um token (um crachá criptografado) para este usuário recém-criado
    refresh = RefreshToken.for_user(user)
    # Devolve a resposta bem-sucedida em JSON com as chaves para a UI logar e um código "201 Created"
    return Response({
        'user': UserSerializer(user).data,
        'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)},
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Rota para validar credenciais de login e devolver o Token (crachá)."""
    # Importa a função base para testar login
    from django.contrib.auth import authenticate
    # Verifica o banco de dados. Devolve None caso a senha ou usuário estejam incorretos.
    user = authenticate(email=request.data.get('email'), password=request.data.get('password'))
    if not user:
        # Rejeita acesso imediatamente
        return Response({'error': 'Credenciais inválidas'}, status=status.HTTP_401_UNAUTHORIZED)
    # Se achou o usuário, emite o crachá
    refresh = RefreshToken.for_user(user)
    return Response({
        'user': UserSerializer(user).data,
        'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)},
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated]) # Só quem já tem o "crachá" / está logado pode fazer logout
def logout(request):
    """Invalida o crachá atual para encerrar a sessão."""
    try:
        # Pega o token enviado na requisição e o joga na 'Lista Negra' (Blacklist) do banco.
        # Assim ninguém poderá usá-lo pra invadir se alguém o tiver roubado
        RefreshToken(request.data['refresh']).blacklist()
    except Exception:
        # Se falhar (ex: token já expirado), apenas ignora silênciosamente e segue.
        pass
    # Devolve código 204 indicando sucesso absoluto, sem nenhum texto anexo ("NO CONTENT")
    return Response(status=status.HTTP_204_NO_CONTENT)

# -------------------------------------------------------------
# ROTAS E CONFIGURAÇÕES PARA DATASETS
# -------------------------------------------------------------

# Alguns Datasets clássicos prontos para uso caso o usuário seja novo e não tenha um arquivo em mãos.
EXAMPLE_DATASETS = [
    {
        'id': 'example-iris',
        'name': 'Iris',
        'description': 'Classificação de espécies de flores (150 amostras, 4 features)',
        'task_type': 'classification',
        'suggested_target': 'species',
        'row_count': 150,
        'columns': {
            'sepal_length': 'float64',
            'sepal_width': 'float64',
            'petal_length': 'float64',
            'petal_width': 'float64',
            'species': 'object',
        },
    },
    {
        'id': 'example-diabetes',
        'name': 'Diabetes',
        'description': 'Classificação de diabetes (768 amostras, 8 features)',
        'task_type': 'classification',
        'suggested_target': 'Outcome',
        'row_count': 768,
        'columns': {
            'Pregnancies': 'int64',
            'Glucose': 'int64',
            'BloodPressure': 'int64',
            'SkinThickness': 'int64',
            'Insulin': 'int64',
            'BMI': 'float64',
            'DiabetesPedigreeFunction': 'float64',
            'Age': 'int64',
            'Outcome': 'int64',
        },
    },
    {
        'id': 'example-california_housing',
        'name': 'California Housing',
        'description': 'Regressão de valor mediano de imóveis (20.640 amostras, 8 features)',
        'task_type': 'regression',
        'suggested_target': 'median_house_value',
        'row_count': 20640,
        'columns': {
            'MedInc': 'float64',
            'HouseAge': 'float64',
            'AveRooms': 'float64',
            'AveBedrms': 'float64',
            'Population': 'float64',
            'AveOccup': 'float64',
            'Latitude': 'float64',
            'Longitude': 'float64',
            'median_house_value': 'float64',
        },
    },
]

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dataset_examples(request):
    """Devolve a lista com os conjuntos de dados-exemplo contida na variável acima."""
    return Response(EXAMPLE_DATASETS)

class DatasetUploadView(APIView):
    """
    Controla o formulário de envio de arquivos novos CSV.
    É uma View Baseada em Classe, facilitando gerir verbos HTTP (get, post...).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Acessa o arquivo físico enviado pela requisição (Multipart form-data)
        file = request.FILES.get('file')
        # Verifica se um arquivo foi realmente enviado, senão grita Erro
        if not file:
            raise ValidationError("Nenhum arquivo enviado")

        # Verifica limite de 5 Megabytes do arquivo e se termina com .csv
        if file.size > 5 * 1024 * 1024:
            raise ValidationError("Arquivo excede 5MB")
        if not file.name.endswith('.csv'):
            raise ValidationError("Apenas arquivos CSV são aceitos")

        # Inicia a leitura do arquivo pelo Pandas para validar se não é lixo
        df = pd.read_csv(file)
        # Exige um formato de tabela mínimo (2 colunas, 10 linhas). Menos que isso a IA não aprende nada.
        if df.shape[1] < 2 or df.shape[0] < 10:
            raise ValidationError("CSV deve ter ao menos 2 colunas e 10 linhas")

        # Determina o título que será mostrado no site
        name = request.data.get('name', file.name)
        # Gera o caminho do arquivo para salvar remotamente. Ex: uuid_usuario/uuid_arquivo.csv
        path = f"{request.user.id}/{uuid4()}.csv"
        # Ao usar pd.read_csv, o "cursor" de leitura chega ao fim do arquivo. 'seek(0)' volta ele para o início
        file.seek(0)
        # Manda os dados que vieram do navegador para a Nuvem de vez.
        upload_csv(file.read(), path)

        # Salva as propriedades sobre ele no nosso banco de dados relacional.
        dataset = Dataset.objects.create(
            user=request.user,
            name=name,
            file_path=path,
            # Percorre cada coluna mapeada no Pandas para catalogar seu tipo
            columns={col: str(dtype) for col, dtype in df.dtypes.items()},
            row_count=len(df),
        )
        # Retorna o item completo validado num JSON
        return Response(DatasetSerializer(dataset).data, status=status.HTTP_201_CREATED)

# Dicionário prático ligando o ID ex ('example-iris') pro arquivo CSV real ex('examples/iris.csv')
_EXAMPLE_PATH_MAP = {ex['id']: f"examples/{ex['id'].replace('example-', '')}.csv" for ex in EXAMPLE_DATASETS}

class DatasetListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retorna uma lista de todos os datasets cadastrados por este usuário, ordenando do mais recente para mais antigo"""
        datasets = Dataset.objects.filter(user=request.user).order_by('-created_at')
        return Response(DatasetListSerializer(datasets, many=True).data)

class DatasetPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Pega os primeiros exemplos (linhas) do dataset para dar um 'gostinho' do que está no arquivo CSV"""
        # Se pediram a prévia de um dataset nativo do sistema
        if pk.startswith('example-'):
            path = _EXAMPLE_PATH_MAP.get(pk)
            if not path:
                return Response({'error': 'Dataset não encontrado'}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Se pediram um dataset que o usuário subiu
            try:
                # Busca do banco, travando por este usuário por segurança
                dataset = Dataset.objects.get(id=pk, user=request.user)
                path = dataset.file_path
            except Dataset.DoesNotExist:
                return Response({'error': 'Dataset não encontrado'}, status=status.HTTP_404_NOT_FOUND)

        # Usamos o Storage (nuvem) para baixar o CSV em memória
        df = download_csv_as_dataframe(path)
        # Calcula quantos itens vazios (NaN) a tabela contém por coluna
        missing = df.isnull().sum()

        # Converte as 5 primeiras linhas para dicionário de forma segura:
        # Faz a conversão manual de tipos numpy/pandas para tipos Python nativos,
        # evitando erros de serialização JSON com colunas bool
        # (ex: Titanic 'adult_male', 'alone') e outros tipos numpy.
        def _safe_value(v):
            """Converte qualquer valor numpy/pandas para tipo Python nativo serializável."""
            if v is None:
                return None
            # Trata NaN e Inf de float
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
            # Tipos booleanos numpy (devem vir antes de integer pois bool é subclasse de int)
            if isinstance(v, (bool,)):
                return bool(v)
            # Tipos inteiros numpy
            if hasattr(v, 'item'):  # cobre numpy.integer, numpy.floating, numpy.bool_
                native = v.item()
                if isinstance(native, float) and (math.isnan(native) or math.isinf(native)):
                    return None
                return native
            return v

        sample_rows = []
        for _, row in df.head(5).iterrows():
            safe_row = {}
            for col in df.columns:
                raw = row[col]
                # pd.isna abrange NaN, NaT e None de forma unificada
                safe_row[col] = None if pd.isna(raw) else _safe_value(raw)
            sample_rows.append(safe_row)

        return Response({
            # Mapeia estatísticas por cada coluna do CSV
            'columns': [
                {'name': col, 'dtype': str(df[col].dtype), 'nullable': bool(missing[col] > 0)}
                for col in df.columns
            ],
            'sample': sample_rows,
            'row_count': len(df),
            'missing_values': {col: int(v) for col, v in missing.items()},
        })

# -------------------------------------------------------------
# ROTAS E REGRAS PARA EXPERIMENTOS (MODELOS MATEMÁTICOS / MACHINE LEARNING)
# -------------------------------------------------------------

# Uma proteção simples com as chaves aceitas para não receberem lixo.
_VALID_MODEL_TYPES = {'linear_regression', 'logistic_regression', 'decision_tree', 'knn', 'random_forest'}

def _train_with_timeout(df, target_col, model_type, hyperparams, timeout=30):
    """
    Como treinamentos exigem muita matemática (processamento), 
    usamos uma Thread (um processo paralelo na CPU) para abortar e matar a tarefa 
    se ela ultrapassar do limite de tempo (ex. 30 segundos).
    Isso não deixa que o servidor fique congelado permanentemente por alguém maldoso treinando algoritmos enormes.
    """
    result = {} # Usamos dicionário pois ele pode ser acessado de dentro da Thread
    error = {}

    def _run():
        # Bloco que realmente treina o modelo rodando isolado
        try:
            # A função .train() está no arquivo `ml_engine.py` e devolve um painel formatado de estatísticas.
            result['metrics'] = ml_engine.train(df, target_col, model_type, hyperparams)
        except Exception as e:
            # Se a Engine explodir (matemática impossível), guarda a bomba.
            error['exc'] = e

    # Configura e dá play no processo separado
    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    # Pede à execução pai (o Django) para esperar pacientemente ele acabar, mas com limite de 30 segundos
    thread.join(timeout=timeout)

    # Se a execução principal voltou da espera, e o subordinado (.is_alive()) continua processando,
    # significa que não acabou em 30s. Subimos um Erro e desistimos.
    if thread.is_alive():
        raise TimeoutError()
    # Se a engine reportou um problema na linha 348, repassamos e subimos ele pro usuário (Ex: divisão por zero).
    if 'exc' in error:
        raise error['exc']
    # Caso ideal, sem erros, devolvemos a métrica
    return result['metrics']

class ExperimentRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Inicia e executa todo um ensaio de Machine Learning com as peças enviadas pelo usuário."""
        # Extrai e pega o contexto do "corpo da requisição web JSON" (Request Body)
        dataset_id = request.data.get('dataset_id', '')
        name = request.data.get('name', '')
        model_type = request.data.get('model_type', '')
        hyperparams = request.data.get('hyperparams', {})
        target_column = request.data.get('target_column', '') # A coluna que a Inteligência deverá aprender a prever

        # Checa se pediram um algoritmo suportado
        if model_type not in _VALID_MODEL_TYPES:
            raise ValidationError(f"model_type inválido. Opções: {', '.join(sorted(_VALID_MODEL_TYPES))}")

        # Identifica de onde vêm os dados csv e verifica se de fato pertencem à pessoa
        if str(dataset_id).startswith('example-'):
            path = _EXAMPLE_PATH_MAP.get(dataset_id)
            if not path:
                raise ValidationError("Dataset de exemplo não encontrado")
            db_dataset = None # Para exemplos, não temos um 'objeto Dataset no banco' então deixamos vazio.
            ds_name = next((ex['name'] for ex in EXAMPLE_DATASETS if ex['id'] == dataset_id), dataset_id)
        else:
            try:
                db_dataset = Dataset.objects.get(id=dataset_id, user=request.user)
                path = db_dataset.file_path
                ds_name = db_dataset.name
            except Dataset.DoesNotExist:
                raise ValidationError("Dataset não encontrado ou não pertence ao usuário")

        # Abre os dados brutos e lê (tabela)
        df = download_csv_as_dataframe(path)

        # Confirma se quem mandou o pedido digitou a coluna alvo exata, sem erro de letras
        if target_column not in df.columns:
            raise ValidationError(f"Coluna '{target_column}' não existe no dataset")

        try:
            # Invoca a nossa rotina inteligente isolada 
            metrics = _train_with_timeout(df, target_column, model_type, hyperparams)
        except TimeoutError:
            # Caso a rotina ultrapassou 30s. A interface lidará com este status como um aviso que "Travou"
            return Response(
                {'error': 'Treinamento excedeu o tempo limite de 30s'},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )

        # Tendo sucesso com a matemática, cria o registro disso no Banco Relacional permanentemente!
        experiment = Experiment.objects.create(
            user=request.user,
            dataset=db_dataset,
            dataset_name=ds_name, # Guardamos pra caso o 'db_dataset' seja deletado depois, o nome do arquivo sobra
            name=name,
            model_type=model_type,
            hyperparams=hyperparams,
            metrics=metrics,
        )
        
        # Envia a notícia da vitória à Interface!
        return Response(ExperimentSerializer(experiment).data, status=status.HTTP_201_CREATED)

class ExperimentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Devolve os experimentos numéricos concluídos pela pessoa, do mais recente pro mais antigo."""
        experiments = (
            Experiment.objects
            .filter(user=request.user)
            .select_related('dataset') # .select_related() funciona como JOIN do SQL. Reduz tempo puxando ambos juntos.
            .order_by('-created_at')
        )
        return Response(ExperimentListSerializer(experiments, many=True).data)

class ExperimentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Ao clicar no Histórico, pega os dados detalhados daquele experimento."""
        try:
            experiment = Experiment.objects.get(id=pk, user=request.user)
        except Experiment.DoesNotExist:
            return Response({'error': 'Experimento não encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ExperimentSerializer(experiment).data)

# -------------------------------------------------------------
# ROTAS DO TUTOR DE INTELIGÊNCIA ARTIFICIAL (OLLAMA LLM)
# -------------------------------------------------------------

# Gera o dicionário dinâmico ex: {'Titanic': 891} com rapidez
_EXAMPLE_ROW_COUNT = {ex['name']: ex['row_count'] for ex in EXAMPLE_DATASETS}

class ChatView(APIView):
    """
    Comunica o chat que o usuário está vendo na tela com o Tutor (robô do Ollama) via texto.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Captura as informações passadas no frontend
        experiment_id = request.data.get('experiment_id')
        messages = request.data.get('messages', []) # Histórico completo de envios anteriores (Eu:"Oi" -> Ele:"Olá")

        if not messages:
            return Response({'error': 'messages não pode ser vazio'}, status=status.HTTP_400_BAD_REQUEST)

        # Checa e busca as propriedades técnicas do que foi o experimento para o nosso Tutor poder orientar.
        try:
            experiment = Experiment.objects.select_related('dataset').get(
                id=experiment_id, user=request.user
            )
        except (Experiment.DoesNotExist, Exception):
            return Response(
                {'error': 'Experimento não encontrado ou não pertence ao usuário'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verifica e calcula os metadados
        if experiment.dataset:
            row_count = experiment.dataset.row_count
        else:
            row_count = _EXAMPLE_ROW_COUNT.get(experiment.dataset_name, 0)

        # Compila um conjunto focado de fatos do treino 
        exp_data = {
            'dataset_name': experiment.dataset_name,
            'dataset_row_count': row_count,
            'model_type': experiment.model_type,
            'hyperparams': experiment.hyperparams,
            'metrics': experiment.metrics,
        }

        # Chama uma rotina 'builder' (Construtor) para injetar essas informações formatadas no 'Prompt do Sistema'
        # Prompts do Sistema dizem "você é um Tutor", eles determinam a personalidade do robô.
        system_prompt = build_system_prompt(exp_data)

        # Insere a nossa Instrução Mestra (system_prompt) acima de todas as demais conversas do painel que o usuário digitou, em ordem.
        llm_messages = [
            {'role': 'system', 'content': system_prompt}, # A diretriz invisível
            *[{'role': m['role'], 'content': m['content']} for m in messages], # O Desempacotamento de toda a lista de envios web
        ]

        # Tenta usar a conexão com o Ollama API, lidando com possíveis sobrecargas (se o servidor IA explodiu)
        try:
            # Função que de fato chama a biblioteca do Ollama enviando o texto.
            reply = chat(llm_messages)
        except Exception:
            # Caso a IA esteja off-line
            logger.exception("Erro ao chamar Ollama")
            return Response(
                {'error': 'Tutor temporariamente indisponível. Tente novamente.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Entrega a resposta processada à Interface do site!
        return Response({'reply': reply})