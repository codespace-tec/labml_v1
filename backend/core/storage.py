from supabase import create_client # Importa a função para criar o cliente do banco e storage do Supabase
from django.conf import settings # Importa as configurações globais do Django (settings.py), de onde pegaremos as chaves
import pandas as pd # Importa a biblioteca Pandas, famosa pela manipulação de tabelas/dataframes
import io # Importa o módulo 'io', usado para manipular bytes e textos em memória como se fossem arquivos

# Cria o cliente do Supabase utilizando a URL e a KEY declaradas nas configurações (originadas do arquivo .env)
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
# Define o nome do "bucket" (a pasta raiz no armazenamento na nuvem) onde guardaremos os arquivos
BUCKET = 'datasets'

def upload_csv(file_bytes: bytes, path: str) -> str:
    """
    Faz upload de um arquivo contido na memória em bytes para o Supabase Storage.
    Retorna o path onde ele foi armazenado na nuvem.
    """
    # Utiliza o cliente do Supabase para fazer o upload na nuvem
    # O comando .from_(BUCKET) seleciona o bucket 'datasets'
    # .upload(caminho_salvamento, arquivo, configuracoes)
    supabase.storage.from_(BUCKET).upload(path, file_bytes, {
        'content-type': 'text/csv', # Avisa ao Supabase que é um arquivo de texto CSV
        'upsert': 'true', # Se um arquivo com mesmo nome/path existir, ele sobrescreve em vez de dar erro
    })
    # Devolve o caminho no qual foi salvo
    return path

def download_csv_as_dataframe(path: str) -> pd.DataFrame:
    """
    Baixa o CSV do Supabase Storage e o converte diretamente para um DataFrame do Pandas.
    A conversão acontece toda na memória (RAM), sem criar arquivo no disco local do servidor.
    """
    # Baixa o conteúdo do arquivo da nuvem em formato de bytes brutos (raw bytes)
    data = supabase.storage.from_(BUCKET).download(path)
    # A função io.BytesIO() transforma os bytes baixados em um objeto que se comporta como um arquivo.
    # Em seguida, o pd.read_csv() do pandas lê esse pseudo-arquivo e o converte para uma tabela interativa (DataFrame).
    return pd.read_csv(io.BytesIO(data))

def delete_file(path: str) -> None:
    """
    Deleta um arquivo de dado path do Supabase Storage.
    """
    # O comando remove pede uma lista de caminhos de arquivos a deletar, e neste caso passamos o nosso único 'path'
    supabase.storage.from_(BUCKET).remove([path])
