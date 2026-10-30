import random # Usado para amostrar pontos de gráficos aleatoriamente
from sklearn.linear_model import LinearRegression, LogisticRegression # Modelos básicos e fundamentais lineares
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor # Modelos de árvore (capazes de aprender regras "se-então")
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor # Modelos baseados na distância e proximidade
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor # Modelos Ensemble (múltiplas árvores de decisão)
from sklearn.model_selection import train_test_split # Utilitário para separar dados de Treino e Teste
from sklearn.preprocessing import LabelEncoder, StandardScaler # Utilitário para transformar texto e padronizar escalas
from sklearn.metrics import ( # Ferramentas para medir se o modelo foi bem ou mal (Acurácia, Erro, etc)
    accuracy_score, classification_report,
    confusion_matrix, r2_score, mean_absolute_error,
    root_mean_squared_error, roc_curve, auc,
)
import pandas as pd # Para lidar com as tabelas de dados (DataFrames)
import numpy as np # Para lidar com computação vetorial/arrays matemáticos


def train(df: pd.DataFrame, target_col: str, model_type: str, hyperparams: dict) -> dict:
    """
    Treina o modelo de Machine Learning de acordo com os parâmetros definidos 
    e retorna as métricas matemáticas finais para serem salvas.
    """
    # X (maiúsculo por convenção matricial) vai ser a tabela sem a coluna que queremos prever
    X = df.drop(columns=[target_col])
    # y (minúsculo por convenção de vetor) vai ser apenas a coluna alvo/target
    y = df[target_col]

    # Transforma todo dado de texto existente no dataset em números e preenche vazios
    X = _encode_features(X)

    # Identificamos automaticamente se é uma classificação:
    # A coluna é de "texto" (object) ou a coluna tem poucos números diferentes (ex: 0 e 1 apenas)
    is_classification = y.dtype == 'object' or y.nunique() <= 20

    # Se o modelo for Regressão Logística, obrigatoriamente precisamos de um alvo de classificação.
    # Se a variável alvo original for contínua, binarizamos usando a mediana para evitar erros.
    if model_type == 'logistic_regression' and not is_classification:
        y = (y > y.median()).astype(int)
        is_classification = True

    if is_classification:
        # Se for uma classificação, as classes alvo ("Gato", "Cachorro") viram (0, 1) obrigatoriamente
        le = LabelEncoder()
        y = le.fit_transform(y)

    # Verifica qual tamanho de partição de teste o usuário quis (padrão 20%)
    test_size = float(hyperparams.get('test_size', 0.2))
    
    # Esta função divide as variáveis aleatoriamente. 'X_train, y_train' treina, 'X_test, y_test' testa sem ter visto as respostas
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y if is_classification else None # random_state=42 garante que sempre separará das mesmas formas se repetido
    )

    # Chama a função que instancia de fato a biblioteca scikit-learn
    model = _build_model(model_type, hyperparams, is_classification)
    # A mágica do Machine Learning acontece aqui: a função .fit() faz o algoritmo "aprender" observando X_train e tentando chegar em y_train
    model.fit(X_train, y_train)
    # Pede para o modelo adivinhar as repostas usando os dados separados para teste
    y_pred = model.predict(X_test)

    # Envia os resultados finais obtidos para gerarem um resumo formatado
    if is_classification:
        y_score = None
        if hasattr(model, "predict_proba"):
            try:
                y_score = model.predict_proba(X_test)
            except Exception:
                pass
        metrics = _classification_metrics(y_test, y_pred, le.classes_, y_score)
    else:
        metrics = _regression_metrics(y_test, y_pred)

    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        feature_importances = [
            {'feature': col, 'importance': round(float(imp), 4)}
            for col, imp in zip(X.columns, importances)
        ]
        metrics['feature_importances'] = sorted(feature_importances, key=lambda x: x['importance'], reverse=True)

    return metrics


def _encode_features(X: pd.DataFrame) -> pd.DataFrame:
    """
    Tratamento de dados: Converte colunas com textos para numérico, 
    preenche valores nulos com a mediana e padroniza a escala das features.
    """
    # Varre as colunas que são interpretadas como 'object' (texto/string)
    for col in X.select_dtypes(include='object').columns:
        # O LabelEncoder pega a lista ['A', 'B', 'A'] e vira [0, 1, 0]
        X[col] = LabelEncoder().fit_transform(X[col].astype(str))
    
    # Preenche (fillna) as lacunas vazias (Nulo/NaN) pela mediana matemática daquela coluna
    X = X.fillna(X.median(numeric_only=True))
    
    # Padroniza as features para terem média 0 e desvio padrão 1
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns, index=X.index)
    
    return X_scaled


def _build_model(model_type: str, hyperparams: dict, is_classification: bool):
    """
    Inicializa (instancia) a classe correspondente de modelo da biblioteca Scikit-Learn (sklearn).
    """
    if model_type == 'linear_regression':
        return LinearRegression()
    if model_type == 'logistic_regression':
        # Pega a penalidade (C) dos hiperparâmetros (1.0 por padrão)
        C = float(hyperparams.get('C', 1.0))
        return LogisticRegression(C=C, max_iter=1000)
    if model_type == 'decision_tree':
        # A árvore não deve crescer muito para não sobreajustar ("decorar" os dados) (Overfitting)
        max_depth = int(hyperparams.get('max_depth', 3)) or None
        # Decide qual tipo usar (Uma Árvore pode classificar coisas discretas ou prever números contínuos)
        cls = DecisionTreeClassifier if is_classification else DecisionTreeRegressor
        return cls(max_depth=max_depth, random_state=42)
    if model_type == 'knn':
        # n_neighbors diz pra quantos vizinhos próximos o modelo deve olhar
        n_neighbors = int(hyperparams.get('n_neighbors', 5))
        cls = KNeighborsClassifier if is_classification else KNeighborsRegressor
        return cls(n_neighbors=n_neighbors)
    if model_type == 'random_forest':
        # n_estimators define o número de árvores na floresta
        n_estimators = int(hyperparams.get('n_estimators', 100))
        # max_depth define a profundidade máxima de cada árvore
        max_depth = hyperparams.get('max_depth', None)
        if max_depth is not None:
            max_depth = int(max_depth)
        cls = RandomForestClassifier if is_classification else RandomForestRegressor
        return cls(n_estimators=n_estimators, max_depth=max_depth, random_state=42)
    
    # Se enviaram um nome errado
    raise ValueError(f"Modelo desconhecido: {model_type}")


def _make_serializable(obj):
    """
    Função utilitária interna: 
    Converte as estruturas originadas do NumPy para os tipos nativos de dados do Python (int, float, list, dict),
    porque o banco de dados via campo "JSONField" não entende o formato numérico interno do NumPy e daria erro para salvar.
    Essa conversão é recursiva, lendo as estruturas de dentro para fora.
    """
    if isinstance(obj, dict):
        return {str(k): _make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_make_serializable(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def _classification_metrics(y_test, y_pred, classes, y_score=None) -> dict:
    """
    Calcula o desempenho para algoritmos voltados a prever categorias limitadas.
    """
    # Matriz de Confusão: É uma matriz que revela os Falsos Positivos e Falsos Negativos
    cm = confusion_matrix(y_test, y_pred).tolist()
    # Pega um relatório com estatísticas como Precisão (Precision), Sensibilidade (Recall) e F1-Score
    report = classification_report(y_test, y_pred, target_names=classes, output_dict=True)
    
    # Calcular as curvas ROC para cada classe
    roc_curves = {}
    if y_score is not None:
        for i, class_name in enumerate(classes):
            # Para a classe i, tratamos ela como a classe positiva (1) e as outras como negativa (0)
            y_test_binary = (y_test == i).astype(int)
            
            # Se y_score for 2D, pegamos a coluna correspondente à classe
            if len(y_score.shape) == 2:
                prob_col = y_score[:, i]
            else:
                prob_col = y_score
                
            fpr, tpr, _ = roc_curve(y_test_binary, prob_col)
            roc_auc = auc(fpr, tpr)
            
            # Simplifica os pontos se houver muitos para não sobrecarregar o JSON
            if len(fpr) > 200:
                indices = np.linspace(0, len(fpr) - 1, 200, dtype=int)
                fpr = fpr[indices]
                tpr = tpr[indices]
                
            roc_curves[str(class_name)] = {
                'fpr': [float(x) for x in fpr],
                'tpr': [float(x) for x in tpr],
                'auc': round(float(roc_auc), 4)
            }
            
    # Devolve um resumo empacotado que o Django consiga salvar como JSON e que o frontend possa exibir
    return _make_serializable({
        'task_type': 'classification',
        'accuracy': round(float(accuracy_score(y_test, y_pred)), 4), # Acertou quantos no total?
        'confusion_matrix': cm,
        'classes': list(classes), # Quais são as respostas possíveis
        'classification_report': report,
        'roc_curves': roc_curves,
    })


def _regression_metrics(y_test, y_pred) -> dict:
    """
    Calcula o desempenho para algoritmos voltados a prever números contínuos, como preços ou nota.
    """
    # Converte os resultados do formato da biblioteca/Series em uma simples lista Python
    actual = y_test.tolist() if hasattr(y_test, 'tolist') else list(y_test)
    predicted = y_pred.tolist() if hasattr(y_pred, 'tolist') else list(y_pred)
    
    # Junta os acertos lado-a-lado usando zip. Fica [(real1, prev1), (real2, prev2), ...]
    pairs = list(zip(actual, predicted))
    
    # Sorteia aleatoriamente até 200 pontos para não travar o navegador enviando pontilhados inteiros
    sample = random.sample(pairs, min(200, len(pairs)))
    
    # Devolve tudo empacotado e arredondado para exibir na tela do frontend
    return {
        'task_type': 'regression',
        'r2': round(float(r2_score(y_test, y_pred)), 4), # Mais perto de 1 significa que o modelo aprendeu muito
        'mae': round(float(mean_absolute_error(y_test, y_pred)), 4), # Erro mediano base
        'rmse': round(float(root_mean_squared_error(y_test, y_pred)), 4), # Erro quadrático, pune os erros astronômicos de previsão
        'scatter_sample': [{'actual': a, 'predicted': p} for a, p in sample],
    }
