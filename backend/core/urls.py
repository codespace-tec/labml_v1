from django.urls import path # Importa a função path do Django, usada para definir as rotas (URLs) do aplicativo
from rest_framework_simplejwt.views import TokenRefreshView # Importa a view padrão do JWT para atualizar o token de acesso (Refresh)
from . import views # Importa o arquivo views.py atual, onde estão as funções/classes que processam as requisições

# A lista 'urlpatterns' define como as URLs da API são mapeadas para o código Python
urlpatterns = [
    # -- Rotas de Autenticação (Auth) --
    # Rota para cadastrar novo usuário (Chama a função register em views.py)
    path('auth/register/', views.register),
    # Rota para fazer o login de um usuário e receber os tokens (Chama a função login)
    path('auth/login/', views.login),
    # Rota padrão fornecida pelo simplejwt para enviar um refresh token e receber um novo access token
    path('auth/refresh/', TokenRefreshView.as_view()),
    # Rota para encerrar a sessão, invalidando o token (Chama a função logout)
    path('auth/logout/', views.logout),

    # -- Rotas de Datasets --
    # Rota GET para listar os datasets carregados pelo usuário. '.as_view()' é usado pois é uma Class-Based View
    path('datasets/', views.DatasetListView.as_view()),
    # Rota POST para realizar o upload de um novo arquivo CSV
    path('datasets/upload/', views.DatasetUploadView.as_view()),
    # Rota GET para listar datasets embutidos de exemplo que o sistema fornece (Iris, Diabetes, etc) (function-based view)
    path('datasets/examples/', views.dataset_examples),
    # Rota GET para obter os dados em amostra (preview) de um dataset específico identificado por seu 'pk' (Primary Key, que pode ser string/UUID)
    path('datasets/<str:pk>/preview/', views.DatasetPreviewView.as_view()),

    # -- Rotas de Experimentos de Machine Learning --
    # Rota GET para ver a lista de treinamentos já realizados pelo usuário
    path('experiments/', views.ExperimentListView.as_view()),
    # Rota POST para disparar o treinamento de um modelo de IA com base em um dataset configurado
    path('experiments/run/', views.ExperimentRunView.as_view()),
    # Rota GET para ver os detalhes completos de um experimento específico usando seu UUID (pk = Primary Key)
    path('experiments/<uuid:pk>/', views.ExperimentDetailView.as_view()),

    # -- Rota do Tutor IA --
    # Rota POST para enviar mensagens ao Tutor de IA do sistema.
    path('chat/', views.ChatView.as_view()),
]