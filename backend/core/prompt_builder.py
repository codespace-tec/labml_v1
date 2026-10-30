def build_system_prompt(experiment: dict) -> str:
    """
    Constrói a instrução de base (system prompt) que diz à Inteligência Artificial 
    como ela deve se comportar. O prompt recebe as informações do experimento de ML do usuário.
    """
    # Extrai as métricas resultantes do dicionário 'experiment'
    metrics = experiment['metrics']
    # Identifica se é classificação ou regressão. Se não encontrar, define 'unknown'
    task_type = metrics.get('task_type', 'unknown')

    # Começa a montar uma lista de strings que será o contexto técnico enviado à IA
    context_lines = [
        # Linha 1: Nome do dataset e quantas linhas de dado ele tem
        f"- Dataset: {experiment['dataset_name']} ({experiment['dataset_row_count']} amostras)",
        # Linha 2: Nome amigável do modelo matemático escolhido
        f"- Modelo: {_model_label(experiment['model_type'])}",
        # Linha 3: Quais foram as configurações/parâmetros definidos
        f"- Hiperparâmetros: {_format_hyperparams(experiment['hyperparams'])}",
    ]

    # Se a tarefa for de Classificação, mostramos métricas focadas nisso
    if task_type == 'classification':
        context_lines += [
            # Converte a acurácia (ex: 0.85) em porcentagem (85.0%)
            f"- Acurácia: {metrics['accuracy'] * 100:.1f}%",
            # Lista os nomes das categorias
            f"- Classes: {', '.join(str(c) for c in metrics['classes'])}",
            # Calcula qual classe o modelo foi pior em acertar (para a IA poder discutir sobre)
            f"- Classe com menor F1: {_worst_class(metrics['classification_report'])}",
        ]
    # Se a tarefa for Regressão, mostramos as métricas específicas dessa área
    elif task_type == 'regression':
        context_lines += [
            # Coeficiente de determinação (quão bem a reta se ajusta aos dados)
            f"- R²: {metrics['r2']}",
            # Erro médio absoluto
            f"- MAE: {metrics['mae']}",
            # Raiz do erro quadrático médio (penaliza erros grandes)
            f"- RMSE: {metrics['rmse']}",
        ]

    # Junta as strings da lista separando-as por quebras de linha ('\n')
    context_block = '\n'.join(context_lines)

    # Retorna o texto principal que orienta a IA, inserindo o bloco construído acima
    return f"""Você é um tutor de machine learning para estudantes. \
Seu papel é estimular o raciocínio crítico fazendo perguntas orientadoras. \
Nunca entregue a resposta diretamente — guie o aluno a descobrir por conta própria. \
Mas se o aluno tem dúvidas sobre modelos, métricas, classes ou hiperparâmetros, explique de forma didática e amigável. 

Regras:
- Responda em no máximo 2-4 frases curtas.
- Se for possível, termine sempre com 1 pergunta reflexiva.
- Use linguagem simples e acessível.
- Se o aluno perguntar algo fora do contexto de ML, redirecione gentilmente.
- Se o aluno tiver duvidas sobre modelos, alguma métrica, classe ou hiperparâmetro, explique de forma didática e amigável.

Contexto do experimento atual:
{context_block}"""

def _model_label(model_type: str) -> str:
    """
    Função utilitária que converte os nomes técnicos dos modelos em nomes amigáveis em português.
    """
    labels = {
        'linear_regression': 'Regressão Linear',
        'logistic_regression': 'Regressão Logística',
        'decision_tree': 'Árvore de Decisão',
        'knn': 'KNN',
        'random_forest': 'Random Forest',
    }
    # Se ele achar o label no dicionário ele retorna, senão ele devolve o próprio model_type original
    return labels.get(model_type, model_type)

def _format_hyperparams(hyperparams: dict) -> str:
    """
    Função utilitária que transforma o dicionário de configurações em uma string de texto corrido (chave=valor).
    """
    # Gera uma lista de 'Chave=Valor', junta tudo separado por vírgulas e retorna.
    return ', '.join(f"{k}={v}" for k, v in hyperparams.items())

def _worst_class(report: dict) -> str:
    """
    Função que avalia o relatório de classificação e descobre qual categoria
    teve a pior pontuação (baseado no F1-score).
    """
    # Cria um dicionário filtrando apenas as chaves que sejam de fato classes e que contenham a chave 'f1-score'
    classes = {k: v['f1-score'] for k, v in report.items()
               if isinstance(v, dict) and 'f1-score' in v}
    # Se não houver classes listadas, retorna N/A
    if not classes:
        return 'N/A'
    # Encontra a chave (nome da classe) cujo valor no dicionário (o f1-score) é o menor (usando 'classes.get' como regra)
    return min(classes, key=classes.get)
