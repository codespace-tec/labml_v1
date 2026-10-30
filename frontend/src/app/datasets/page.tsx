'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  UploadCloud, FileSpreadsheet, Check, Loader2, FlaskConical, Trash2,
} from 'lucide-react'
import { toast } from 'sonner' // Ferramenta de alerta/notificações
import { AppShell } from '@/components/AppShell'
import { Pill } from '@/components/Pill'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api' // Fetch que injeta automaticamente nosso token JWT
import { handleApiError } from '@/lib/api-errors'
import { cn } from '@/lib/utils'

// ─── Tipagens TypeScript ────────────────────────────────────────────────────────────────────
// Modelam como esperamos que o servidor envie os dados dos DataSets

interface UserDataset {
  id: string
  name: string
  row_count: number
  columns: Record<string, string> // Ex: {"idade": "int64", "nome": "object"}
  created_at: string
}

interface ExampleDataset {
  id: string
  name: string
  description: string
  task_type: 'classification' | 'regression'
  suggested_target: string
  row_count: number
  columns: Record<string, string>
}

// Tipo que abraça qualquer um dos dois (Aquele que nós criamos OU os exemplos padrão do sistema)
type AnyDataset = UserDataset | ExampleDataset

interface PreviewColumn {
  name: string
  dtype: string
  nullable: boolean
}

// Metadados sobre a tabela que recebemos do Pandas via Backend
interface Preview {
  columns: PreviewColumn[]
  sample: Record<string, unknown>[] // Lista de linhas (json)
  row_count: number
}

// Uma Função "Type Guard": Serve para perguntar ao TypeScript "Isto é um Dataset de Exemplo?"
function isExample(d: AnyDataset): d is ExampleDataset {
  return d.id.startsWith('example-')
}

// ─── Página Principal ────────────────────────────────────────────────────────────────────

export default function DatasetsPage() {
  // Variáveis de Estado
  const [userDatasets, setUserDatasets] = useState<UserDataset[]>([])
  const [examples, setExamples] = useState<ExampleDataset[]>([])
  const [loading, setLoading] = useState(true) // Controla Skeleton de carregamento principal
  
  // Guardam qual Dataset foi clicado e o seu Preview
  const [selected, setSelected] = useState<AnyDataset | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  
  // Guardam estados da Área de Arrasto de Arquivo (Drag & Drop)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null) // Para girar engrenagem no botão lixeira específico
  
  // Referência oculta a um Input HTML nativo do tipo Arquivo
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ao abrir a tela, pede todos os dados
  useEffect(() => {
    // Promise.all roda as DUAS requisições do Django ao mesmo tempo em paralelo
    Promise.all([
      apiFetch('/datasets/').then(r => r.ok ? r.json() : []),
      apiFetch('/datasets/examples/').then(r => r.ok ? r.json() : []),
    ]).then(([user, ex]) => {
      // Quando ambas voltarem, armazena na memória (estado)
      setUserDatasets(user)
      setExamples(ex)
      // Se tiver exemplo, já deixa o primeiro clicado (selecionado) por padrão
      if (ex.length > 0) selectDataset(ex[0])
    }).finally(() => setLoading(false)) // Finaliza esqueleto de carregamento global
  }, []) // eslint-disable-line

  // Executa toda vez que o usuário clica em um Card de Dataset diferente
  async function selectDataset(ds: AnyDataset) {
    setSelected(ds) // Marca a caixinha em verde
    setPreview(null) // Apaga tabela anterior
    setLoadingPreview(true) // Liga carregamento da tabela

    try {
      // Requisita pro backend enviar só as primeiras 5 linhas pra desenhar
      const r = await apiFetch(`/datasets/${ds.id}/preview/`)
      if (r.ok) {
        setPreview(await r.json())
      } else {
        const err = await r.json().catch(() => ({}))
        const msg = typeof err === 'object' && err !== null
          ? (Object.values(err).flat().join(' ') || 'Erro ao carregar preview.')
          : 'Erro ao carregar preview.'
        toast.error(`Preview indisponível: ${msg}`)
      }
    } catch (err) {
      handleApiError(err)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Função principal de upload de CSV para a Nuvem
  async function uploadFile(file: File) {
    // Validações imediatas pelo navegador sem gastar banda da internet
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Apenas arquivos CSV são aceitos')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo permitido: 5MB')
      return
    }

    setUploading(true) // Muda texto da caixa pra "Enviando..." e bloqueia ela
    try {
      // Cria um formulário tipo 'multipart/form-data' por debaixo dos panos para anexar arquivos via JS
      const form = new FormData()
      form.append('file', file)
      form.append('name', file.name.replace(/\.csv$/i, ''))

      // Faz o POST pesado contendo os Megabytes inteiros
      const r = await apiFetch('/datasets/upload/', { method: 'POST', body: form })
      if (r.ok) {
        // Se sucesso, puxa o novo Dataset pra lista, pro card dele já nascer clicado
        const newDs: UserDataset = await r.json()
        setUserDatasets(prev => [newDs, ...prev])
        selectDataset(newDs)
      } else if (r.status >= 500) {
        toast.error('Algo deu errado. Tente novamente.') // Caiu o servidor
      } else {
        // Erros "inteligentes" emitidos pelo backend (Ex: CSV sem dados, coluna falhada)
        const err = await r.json().catch(() => ({}))
        toast.error(
          Array.isArray(err) ? err.join(' ') :
          typeof err === 'object' ? (Object.values(err).flat().join(' ') || 'Erro ao fazer upload.') :
          'Erro ao fazer upload.',
        )
      }
    } catch (err) {
      handleApiError(err)
    } finally {
      setUploading(false) // Libera a caixinha de arquivo
      if (fileInputRef.current) fileInputRef.current.value = '' // Zera o input caso tentem upar o exato mesmo arquivo
    }
  }

  // Quando clica e abre o explorador do Windows
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  // Quando arrasta e solta usando o Mouse
  function handleDrop(e: React.DragEvent) {
    e.preventDefault() // Impede do navegador abrir o arquivo nativamente estragando o site
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  // Chama a exclusão do dataset no DB e limpa a memória RAM
  async function handleDelete(id: string) {
    setDeletingId(id)
    const r = await apiFetch(`/datasets/${id}/`, { method: 'DELETE' })
    if (r.ok || r.status === 204) {
      setUserDatasets(prev => prev.filter(d => d.id !== id))
      // Se deletamos logo aquele que estava focado, zera as coisas
      if (selected?.id === id) {
        setSelected(null)
        setPreview(null)
      }
    }
    setDeletingId(null)
  }

  // Descobre se a coluna é matemática ou de texto pelo tipo fornecido pelo Pandas
  function dtypeVariant(dtype: string): 'Numeric' | 'Categorical' {
    return dtype.includes('int') || dtype.includes('float') ? 'Numeric' : 'Categorical'
  }

  // Array Unificado para jogar no map() e desenhar os retângulos de seleção
  const allDatasets: AnyDataset[] = [...userDatasets, ...examples]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* 1. Header Fixo Superior */}
        <div>
          <h1 className="text-2xl font-semibold">Datasets</h1>
          <p className="text-muted-foreground mt-1">
            Carregue seu próprio CSV ou comece com um dos datasets de exemplo.
          </p>
        </div>

        {/* 2. ÁREA DE UPLOAD (DRAG & DROP) */}
        {/* O 'input file' verdadeiro está escondido pelo CSS "hidden" */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
        {/* A caixa bonita desenhada atua como fachada, repassando o clique para o 'input' oculto lá de cima */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={cn(
            'rounded-xl border-2 border-dashed p-10 text-center transition-colors bg-card cursor-pointer',
            // Altera visual se tiver alguém arrastando arquivo sobre ela no exato instante
            dragging ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/40',
            uploading && 'pointer-events-none opacity-70',
          )}
        >
          <div className="mx-auto h-12 w-12 rounded-full bg-primary-soft text-primary flex items-center justify-center">
            {uploading
              ? <Loader2 className="h-6 w-6 animate-spin" /> // Engrenagem gerando
              : <UploadCloud className="h-6 w-6" />}
          </div>
          <h3 className="mt-3 font-semibold">
            {uploading ? 'Enviando…' : 'Arraste seu CSV aqui'}
          </h3>
          {!uploading && (
            <p className="text-sm text-muted-foreground mt-1">
              ou clique para selecionar · máx 5MB · cabeçalhos obrigatórios
            </p>
          )}
        </div>

        {/* Barrinha de progresso bonita abaixo da caixa */}
        {uploading && (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/3 bg-primary rounded-full animate-[progress-indeterminate_1.4s_ease-in-out_infinite]" />
          </div>
        )}

        {/* 3. LISTA DE CARTÕES COM DATASETS */}
        {loading ? (
          // Esqueletos vazios enquanto carrega a página
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-5 space-y-3 bg-card">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : allDatasets.length > 0 && (
          // Dados Reais
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {userDatasets.length > 0 ? 'Todos os datasets' : 'Datasets de exemplo'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {allDatasets.map(ds => {
                const active = selected?.id === ds.id
                const colCount = Object.keys(ds.columns ?? {}).length
                const taskType = isExample(ds) ? ds.task_type : null
                return (
                  // 'button' foi usado para que a caixa inteira seja clicável nativamente
                  <button
                    key={ds.id}
                    onClick={() => selectDataset(ds)}
                    className={cn(
                      'text-left bg-card border rounded-xl p-5 shadow-sm transition-all relative',
                      // Deixa brilhante com anel se estiver selecionado ativamente
                      active
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/40',
                    )}
                  >
                    {/* Tickbox (Certo V) circular no canto caso selecionado */}
                    {active && (
                      <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    )}

                    <div className="flex items-center gap-2 pr-8">
                      <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-semibold truncate">{ds.name}</h3>
                    </div>

                    {isExample(ds) && (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                        {ds.description}
                      </p>
                    )}

                    {/* Metadados (Linhas, colunas, tipo de Regressão) */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      {taskType && (
                        <Pill variant={taskType === 'classification' ? 'Classification' : 'Regression'}>
                          {taskType === 'classification' ? 'Classificação' : 'Regressão'}
                        </Pill>
                      )}
                      <span className="tabular-nums">{ds.row_count.toLocaleString('pt-BR')} linhas</span>
                      {colCount > 0 && <><span>·</span><span className="tabular-nums">{colCount} cols</span></>}
                    </div>

                    {/* Botão flutuante de DELETAR apenas se NÃO for exemplo do sistema (pois eles são fixos) */}
                    {!isExample(ds) && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(ds.id) }} // stopPropagation evita clicar o card inteiro junto
                        disabled={deletingId === ds.id} // Congela para evitar enviar 2 deletes e dar bug
                        className="absolute bottom-3 right-3 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                        aria-label="Excluir"
                      >
                        {deletingId === ds.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> // Engrenagem girando
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 4. MESA DE PRÉ-VISUALIZAÇÃO DE DADOS (PREVIEW TABLE) */}
        {/* Renderiza apenas se houver um Dataset Selecionado na lista */}
        {selected && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            
            {/* Cabecalho da Mesa com metadados do Dataset */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold">{selected.name} — preview</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {loadingPreview ? 'Carregando…' : `Primeiras ${preview?.sample.length ?? 0} linhas`}
                </p>
              </div>

              {/* Botões do Lado Direito da Mesa */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Se as colunas voltaram da API de preview, desenha os pill's indicando o tipo delas */}
                {preview?.columns.map(c => (
                  <span
                    key={c.name}
                    className="inline-flex items-center gap-1.5 text-xs bg-muted rounded px-2 py-1 font-mono"
                  >
                    {c.name}
                    <Pill variant={dtypeVariant(c.dtype)}>{dtypeVariant(c.dtype)}</Pill>
                  </span>
                ))}

                {/* Atalho brilhante para navegar para a aba NOVO EXPERIMENTO, já auto-preenchendo a URL com os dados daqui */}
                <Link
                  href={`/experiments/new?dataset_name=${encodeURIComponent(selected.name)}`}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors"
                >
                  <FlaskConical className="h-3 w-3" />
                  Usar neste experimento
                </Link>
              </div>
            </div>

            {/* O Corpo da Tabela Visual */}
            {loadingPreview ? (
              // Tabela Falsa de Esqueletos enquanto dados não chegam via Internet
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <th key={i} className="px-4 py-2.5">
                          <Skeleton className="h-3 w-16" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-2">
                            <Skeleton className="h-3 w-20" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : preview && preview.sample.length > 0 ? (
              // Tabela HTML Real abastecida pelos JSON gerados pelo Pandas
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    {/* Primeira Linha: Os Títulos (Cabeçalhos) */}
                    <tr>
                      {preview.columns.map(c => (
                        <th
                          key={c.name}
                          className="text-left font-semibold px-4 py-2.5 font-mono text-xs whitespace-nowrap"
                        >
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* Cada "row" é um mini objeto JSON correspondente a uma linha do CSV original */}
                    {preview.sample.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        {/* E para cada linha, varre-se a lista de nomes de colunas, procurando a chave respectiva (Ex: row["idade"]) */}
                        {preview.columns.map(c => (
                          <td key={c.name} className="px-4 py-2 tabular-nums whitespace-nowrap">
                            {String(row[c.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Empty state alternativo caso o arquivo venha corrompido sem nenhuma linha
              <p className="p-6 text-sm text-muted-foreground">Sem dados de preview disponíveis.</p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
