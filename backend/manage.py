#!/usr/bin/env python
"""
Utilitário de Linha de Comando (CLI) nativo do Django.

Este arquivo NUNCA precisa ser alterado.
Sua única função é servir de comando para ligar o servidor, 
fazer migrações do banco de dados e rodar tarefas.
Exemplo de uso no terminal: 'python manage.py runserver'
"""
import os
import sys

def main():
    """Roda as tarefas administrativas."""
    # Diz ao Django que o arquivo principal de configuração está na pasta config, arquivo settings.py
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Não foi possível importar o Django. Você ativou o Ambiente Virtual (.venv)?"
        ) from exc
    # Repassa os comandos digitados no terminal para o motor do Django processar
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
