"""
Configuração de Rotas Globais do Django.

Pense neste arquivo como a porta de entrada principal ou a "telefonista" do projeto.
Ele pega a URL digitada no navegador e direciona para o aplicativo correto.
"""
from django.contrib import admin # Importa as telas administrativas do Django
from django.urls import path, include # Importa funções de roteamento

urlpatterns = [
    # Se o usuário acessar seudominio.com/admin/, encaminha para o painel de administrador nativo do Django
    path('admin/', admin.site.urls),
    
    # Se o usuário acessar seudominio.com/api/alguma_coisa, encaminha tudo para o roteador específico dentro do nosso app 'core'
    # É uma boa prática usar 'include' para não deixar esse arquivo gigantesco e confuso.
    path('api/', include('core.urls')),
]