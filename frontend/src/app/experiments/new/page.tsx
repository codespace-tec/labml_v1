'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
// React Hook Form é o motor por trás dos nossos formulários. É leve e valida fácil.
import { useForm, Controller } from 'react-hook-form'
// Zod é o tradutor. Ele valida se o que a pessoa digitou tem tamanho X, é Número ou String
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Play, Loader2, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { Pill } from '@/components/Pill'
import { ExperimentResults, type ExperimentMetrics } from '@/components/ExperimentResults'
import { apiFetch } from '@/lib/api'
import { handleApiError } from '@/lib/api-errors'
import { cn } from '@/lib/utils'

// ─── Tipagens Básicas (Types) ───────────────────────────────────────────────────────────────────

interface UserDataset {
  id: string
  name: string
  row_count: number
  created_at: string
}

interface ExampleDataset {
  id: string
  name: string
  description: string
  task_type: string
  suggested_target: string
  row_count: number
  columns: Record<string, string>
}

interface ExperimentResult {
  id: string
  name: string
  model_type: string
  metrics: ExperimentMetrics
  dataset_name: string
}

// ─── Esquema de Validação (Schema do Zod) ────────────────────────────────────────────────────────
// Aqui ensinamos ao React exatamente QUAIS regras nosso Formulário exige antes de deixar clicar em 'Treinar'
const schema = z.object({
  datasetId: z.string().min(1, 'Selecione um dataset'), // Texto vazio não pode
  name: z.string().min(1, 'Nome obrigatório').max(100), // Máximo de letras pra caber no banco de dados
  targetColumn: z.string().min(1, 'Selecione a coluna alvo'),
  modelType: z.enum(['linear_regression', 'logistic_regression', 'decision_tree', 'knn', 'random_forest']), // Só pode ser uma das opções fixas
  hyperparams: z.object({
    test_size: z.number().min(0.1).max(0.4), // 10% a 40%
    max_depth: z.number().int().min(0).max(20).optional(), // Deixa como Opcional (Depende do modelo)
    n_neighbors: z.number().int().min(1).max(20).optional(),
    C: z.number().min(0.01).max(10).optional(),
    n_estimators: z.number().int().min(10).max(200).optional(),
  }),
})

type FormData = z.infer<typeof schema>

// Constantes Visuais
const MODELS = [
  { value: 'linear_regression', label: 'Regressão Linear' },
  { value: 'logistic_regression', label: 'Regressão Logística' },
  { value: 'decision_tree', label: 'Árvore de Decisão' },
  { value: 'knn', label: 'KNN' },
  { value: 'random_forest', label: 'Random Forest' },
] as const

// ─── Componente Principal da Página ────────────────────────────────────────────────────────────

export default function NewExperimentPage({
  searchParams, // Parâmetros que vêm escritos na URL da barra do navegador (?dataset_name=X)
}: {
  searchParams: Promise<{ dataset_name?: string }>
}) {
  const sp = use(searchParams)
  const presetDatasetName = sp.dataset_name

  // Memória React
  const [userDatasets, setUserDatasets] = useState<UserDataset[]>([])
  const [exampleDatasets, setExampleDatasets] = useState<ExampleDataset[]>([])
  const [columns, setColumns] = useState<string[]>([]) // Lista de colunas do dataset escolhido
  const [datasetMeta, setDatasetMeta] = useState<{ name: string; row_count: number } | null>(null)
  
  const [loadingCols, setLoadingCols] = useState(false) // Carregando metadados do servidor
  const [training, setTraining] = useState(false) // Girando engrenagem de Treino de IA
  const [result, setResult] = useState<ExperimentResult | null>(null) // Sucesso do treino
  const [serverError, setServerError] = useState<string | null>(null) // Erro vindo do Python

  // ── Inicializa o React Hook Form com o Zod ──
  // Ele vai gerenciar as variáveis do form e nos avisar se o cara tentar enviar com falhas
  const { control, handleSubmit, watch, setValue, register, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { // Os valores de fábrica que o laboratório começa preenchido
      datasetId: '',
      name: '',
      targetColumn: '',
      modelType: 'decision_tree', // Começa sendo Árvore de Decisão
      hyperparams: { test_size: 0.2, max_depth: 3, n_neighbors: 5, C: 1.0, n_estimators: 100 },
    },
  })

  // 'watch' fica espionando o valor selecionado do 'modelType' (Ex: Mudou de Arvore para Regressao Linear)
  const modelType = watch('modelType')

  // ── Carrega os Datasets Assim Que a Tela Abre ──
  useEffect(() => {
    Promise.all([
      apiFetch('/datasets/').then(r => r.ok ? r.json() : []),
      apiFetch('/datasets/examples/').then(r => r.ok ? r.json() : []),
    ]).then(([user, examples]) => {
      setUserDatasets(user)
      setExampleDatasets(examples)
    })
  }, [])

  // ── Automação Inteligente da URL ──
  // Se o usuário clicou em "Usar neste Experimento" em outra página, a URL veio com '?dataset_name=Iris'
  // Essa função vasculha a lista e auto-preenche o menu suspenso pra ele!
  useEffect(() => {
    if (!presetDatasetName || (userDatasets.length === 0 && exampleDatasets.length === 0)) return
    const ex = exampleDatasets.find(e => e.name === presetDatasetName)
    if (ex) { handleDatasetSelect(ex.id, ex); return }
    const ud = userDatasets.find(d => d.name === presetDatasetName)
    if (ud) handleDatasetSelect(ud.id, null)
  }, [presetDatasetName, userDatasets, exampleDatasets]) // eslint-disable-line

  // ── Evento quando o usuário troca o Dataset no Menu Suspenso ──
  // (Precisamos buscar no backend quais as colunas do dataset escolhido)
  const handleDatasetSelect = useCallback(async (id: string, exampleData: ExampleDataset | null) => {
    // 1. Diz ao React Hook Form que esse foi o ID escolhido
    setValue('datasetId', id)
    // 2. Apaga a coluna alvo anterior
    setValue('targetColumn', '')
    setColumns([])
    setDatasetMeta(null)
    setServerError(null)

    if (!id) return // Se escolheu a opção vazia, sai

    // Se é um dataset de exemplo padrão do sistema, nós JÁ TEMOS a lista de colunas que veio junto com o arquivo.
    if (id.startsWith('example-') && exampleData) {
      const cols = Object.keys(exampleData.columns)
      setColumns(cols)
      setDatasetMeta({ name: exampleData.name, row_count: exampleData.row_count })
      // BÔNUS: A API diz qual a coluna recomendada para testar. Nós já deixamos preenchida!
      setValue('targetColumn', exampleData.suggested_target)
      // BÔNUS 2: Cria um nome automático bonitinho pro experimento, ex: "Árvore de Decisão em Iris"
      setValue('name', `${MODELS.find(m => m.value === modelType)?.label ?? ''} em ${exampleData.name}`)
      return
    }

    // Se não é de exemplo (foi o usuário que enviou), precisamos bater na API para descobrir que colunas tem lá
    setLoadingCols(true)
    try {
      const r = await apiFetch(`/datasets/${id}/preview/`)
      if (r.ok) {
        const data = await r.json()
        const colNames: string[] = data.columns.map((c: { name: string }) => c.name)
        setColumns(colNames)
        setDatasetMeta({ name: userDatasets.find(d => d.id === id)?.name ?? '', row_count: data.row_count })
      }
    } finally {
      setLoadingCols(false)
    }
  }, [setValue, modelType, userDatasets])

  // ── O Botão Final "Treinar" ──
  async function onSubmit(data: FormData) {
    setTraining(true) // Liga a super tela de carregamento de bloqueio
    setServerError(null)
    setResult(null)

    // Se a máquina do Python estiver "Fria" (ex: demorar no Ollama), envia um Toast depois de 15s pra acalmar o usuário
    const coldStartTimer = setTimeout(() => {
      toast.info('Servidor iniciando, aguarde alguns segundos...')
    }, 15000)

    try {
      // Filtra os hiperparâmetros de acordo com o tipo de modelo para não salvar lixo no banco
      const filteredHyperparams: Record<string, number> = { test_size: data.hyperparams.test_size }
      if (data.modelType === 'decision_tree' && data.hyperparams.max_depth !== undefined) {
        filteredHyperparams.max_depth = data.hyperparams.max_depth
      }
      if (data.modelType === 'logistic_regression' && data.hyperparams.C !== undefined) {
        filteredHyperparams.C = data.hyperparams.C
      }
      if (data.modelType === 'knn' && data.hyperparams.n_neighbors !== undefined) {
        filteredHyperparams.n_neighbors = data.hyperparams.n_neighbors
      }
      if (data.modelType === 'random_forest') {
        if (data.hyperparams.n_estimators !== undefined) {
          filteredHyperparams.n_estimators = data.hyperparams.n_estimators
        }
        if (data.hyperparams.max_depth !== undefined) {
          filteredHyperparams.max_depth = data.hyperparams.max_depth
        }
      }

      // Manda a requisição pro Python disparar o Scikit-Learn
      const r = await apiFetch('/experiments/run/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: data.datasetId,
          name: data.name,
          model_type: data.modelType,
          hyperparams: filteredHyperparams,
          target_column: data.targetColumn,
        }),
      })

      if (r.ok) {
        const result = await r.json()
        // Bingo! Ele retornou os dados treinado! Agora guardamos na memória.
        setResult(result)
        toast.success('Modelo treinado com sucesso!')
      } else if (r.status >= 500) {
        toast.error('Algo deu errado. Tente novamente.') // Crash Python (Erro 500)
      } else {
        const err = await r.json().catch(() => ({}))
        // Mostra o erro formal que o Python enviou (ex: "Coluna X não contém números")
        setServerError(
          Array.isArray(err) ? err.join(' ') :
          typeof err === 'object' ? Object.values(err).flat().join(' ') :
          'Erro ao treinar o modelo.'
        )
      }
    } catch (err) {
      handleApiError(err)
    } finally {
      clearTimeout(coldStartTimer) // Desarma o alerta de demora
      setTraining(false) // Desliga a super tela de carregamento
    }
  }

  // ─── Tela Renderizada ──────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-4rem)] overflow-hidden">

        {/* LADO ESQUERDO: BARRA DE CONFIGURAÇÕES VERTICAL */}
        <aside className="w-full lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card overflow-y-auto p-5 space-y-5">

          {/* CAIXA DE DATASET */}
          <ConfigSection title="Dataset">
            {/* O Controller do React-Hook-Form conecta esse 'select' HTML às regras do Zod lá de cima */}
            <Controller
              control={control}
              name="datasetId"
              render={({ field }) => (
                <select
                  value={field.value}
                  onChange={e => {
                    const id = e.target.value
                    const ex = exampleDatasets.find(d => d.id === id) ?? null
                    handleDatasetSelect(id, ex) // Dispara o evento gigante que busca as colunas na internet
                  }}
                  className="w-full min-h-[44px] px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Selecione um dataset…</option>
                  {userDatasets.length > 0 && (
                    <optgroup label="Meus datasets">
                      {userDatasets.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Datasets de exemplo">
                    {exampleDatasets.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </optgroup>
                </select>
              )}
            />
            {/* Imprime debaixo da caixa em vermelho se tiver erro (Ex: "Selecione um Dataset") */}
            {errors.datasetId && <p className="text-xs text-destructive">{errors.datasetId.message}</p>}

            {/* Metadados bonitinhos da Tabela (Opcional, só se escolheu algum) */}
            {loadingCols && <p className="text-xs text-muted-foreground">Carregando colunas…</p>}
            {datasetMeta && !loadingCols && (
              <div className="text-xs text-muted-foreground border border-border rounded-lg p-3 space-y-1">
                <p className="font-medium text-foreground">{datasetMeta.name}</p>
                <p>{datasetMeta.row_count.toLocaleString('pt-BR')} linhas · {columns.length} colunas</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {/* Mostra no máximo 6 colunas, o resto exibe na etiqueta resumida ex: "+3" */}
                  {columns.slice(0, 6).map(c => (
                    <span key={c} className="px-1.5 py-0.5 rounded bg-muted font-mono">{c}</span>
                  ))}
                  {columns.length > 6 && <span className="px-1.5 py-0.5 text-muted-foreground">+{columns.length - 6}</span>}
                </div>
              </div>
            )}
          </ConfigSection>

          {/* CAIXA DE ALVO (Coluna Y) */}
          <ConfigSection title="Coluna alvo">
            <Controller
              control={control}
              name="targetColumn"
              render={({ field }) => (
                <select
                  value={field.value}
                  onChange={field.onChange}
                  disabled={columns.length === 0} // Congela se a pessoa nem escolheu o arquivo CSV antes
                  className="w-full min-h-[44px] px-3 rounded-md border border-input bg-background text-sm font-mono disabled:opacity-50"
                >
                  <option value="">Selecione…</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            />
            {errors.targetColumn && <p className="text-xs text-destructive">{errors.targetColumn.message}</p>}
          </ConfigSection>

          {/* CAIXA DO MODELO IA */}
          <ConfigSection title="Modelo">
            <Controller
              control={control}
              name="modelType"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-1.5">
                  {MODELS.map(m => (
                    // Botões bonitos e minimalistas como opções (estilo toggle buttons do celular)
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => field.onChange(m.value)} // Ao clicar, troca o Model Type de KNN pra Arvore
                      className={cn(
                        'h-9 rounded-md border text-xs font-medium transition-colors px-2 text-center',
                        field.value === m.value
                          ? 'bg-primary text-primary-foreground border-primary' // Selecionado
                          : 'border-border hover:border-primary/40 hover:bg-muted', // Desmarcado
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </ConfigSection>

          {/* CAIXA DE CONTROLE FINO (HIPERPARÂMETROS) */}
          <ConfigSection title="Hiperparâmetros">
            {/* 1. Opções da Árvore (Somente aparece se Arvore estiver selecionada) */}
            {(modelType === 'decision_tree') && (
              <Controller
                control={control}
                name="hyperparams.max_depth"
                render={({ field }) => (
                  <SliderField
                    label="max_depth"
                    value={field.value ?? 3}
                    min={1} max={20} step={1}
                    displayValue={field.value === 0 ? '∞' : String(field.value ?? 3)}
                    onChange={v => field.onChange(v)}
                  />
                )}
              />
            )}
            {/* 2. Opções da Regressão Logística */}
            {modelType === 'logistic_regression' && (
              <Controller
                control={control}
                name="hyperparams.C"
                render={({ field }) => (
                  <SliderField
                    label="C"
                    value={field.value ?? 1}
                    min={0.01} max={10} step={0.01} // Como é precisão C, o passo é minúsculo 0.01
                    displayValue={(field.value ?? 1).toFixed(2)}
                    onChange={v => field.onChange(v)}
                  />
                )}
              />
            )}
            {/* 3. Opções KNN (Votos dos Vizinhos Próximos) */}
            {modelType === 'knn' && (
              <Controller
                control={control}
                name="hyperparams.n_neighbors"
                render={({ field }) => (
                  <SliderField
                    label="n_neighbors"
                    value={field.value ?? 5}
                    min={1} max={20} step={1}
                    displayValue={String(field.value ?? 5)}
                    onChange={v => field.onChange(v)}
                  />
                )}
              />
            )}
            {/* 4. Opções Random Forest */}
            {modelType === 'random_forest' && (
              <>
                <Controller
                  control={control}
                  name="hyperparams.n_estimators"
                  render={({ field }) => (
                    <SliderField
                      label="n_estimators"
                      value={field.value ?? 100}
                      min={10} max={200} step={10}
                      displayValue={String(field.value ?? 100)}
                      onChange={v => field.onChange(v)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="hyperparams.max_depth"
                  render={({ field }) => (
                    <SliderField
                      label="max_depth"
                      value={field.value ?? 3}
                      min={1} max={20} step={1}
                      displayValue={field.value === 0 ? '∞' : String(field.value ?? 3)}
                      onChange={v => field.onChange(v)}
                    />
                  )}
                />
              </>
            )}
            {/* Essa opção 'test_size' sempre é comum pra todo tipo de modelo, por isso não tem 'if' */}
            <Controller
              control={control}
              name="hyperparams.test_size"
              render={({ field }) => (
                <SliderField
                  label="test_size"
                  value={field.value}
                  min={0.1} max={0.4} step={0.05} // Regua de fatiar o teste
                  displayValue={`${Math.round(field.value * 100)}%`} // Mostra como "20%" no lugar de "0.2" pra facilitar
                  onChange={v => field.onChange(v)}
                />
              )}
            />
          </ConfigSection>

          {/* CAIXA DE TEXTO COM NOME DA EXPERIÊNCIA */}
          <ConfigSection title="Nome do experimento">
            {/* Usa o register normal e mais simples do hookform ao invés de controller. É perfeito pra textos lisos. */}
            <input
              {...register('name')}
              placeholder="Ex: KNN com Iris"
              className="w-full min-h-[44px] px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </ConfigSection>

          {/* BOTÃO MÁGICO "TREINAR" */}
          {/* Se clicar, o HookForm roda o ZOD. Se validar positivo, ele chama a nossa função 'onSubmit' lá do topo */}
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={training}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-60 transition-colors"
          >
            {training ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Treinando…</>
            ) : (
              <><Play className="h-4 w-4" /> Treinar modelo</>
            )}
          </button>

          {/* Alertas de sistema. Ex: O arquivo tinha colunas nulas demais. */}
          {serverError && (
            <p className="text-xs text-destructive border border-destructive/20 rounded-md p-3">{serverError}</p>
          )}
        </aside>

        {/* MÁSCARA ESCURA (CARREGAMENTO DO LADO DIREITO): Cobre o lado principal caso o treinamento seja muito pesado e demore pra não deixarem apertar em mais nada */}
        {training && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Treinando modelo, aguarde...</p>
            </div>
          </div>
        )}

        {/* LADO DIREITO DA TELA: ONDE APARECERÃO OS GRÁFICOS APÓS O TESTE BATER CERTO */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Caso Vazio (Nem começou a treinar) */}
          {!training && !result && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <FlaskConical className="h-10 w-10 opacity-30" />
              <p className="text-sm">Configure o experimento e clique em Treinar.</p>
            </div>
          )}

          {/* Caso Positivo (Gráficos prumos do Componente Reutilizado ExperimentResults) */}
          {!training && result && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-semibold">{result.name}</h2>
                <Pill variant="Model">
                  {MODELS.find(m => m.value === result.model_type)?.label ?? result.model_type}
                </Pill>
                <Pill variant={result.metrics.task_type === 'classification' ? 'Classification' : 'Regression'}>
                  {result.metrics.task_type === 'classification' ? 'Classificação' : 'Regressão'}
                </Pill>
              </div>

              {/* Injeta as tabelas e gráficos reativos criados lá na folha ExperimentResults.tsx */}
              <ExperimentResults metrics={result.metrics} datasetName={result.dataset_name} />

              <div className="flex justify-end">
                <Link
                  href={`/experiment/${result.id}`}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Ver detalhes completos →
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  )
}

// ─── Componentes Menores Reutilizáveis (Sub-Componentes) ───────────────────────────────────────────────────────────

/** Um simples container para separar grupos de formulários com letrinha fina e maiúscula */
function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

/** Um "Slider" clássico de Arrasto (input type=range) embutido num pacotinho bonito com a etiqueta de valor */
function SliderField({
  label, value, min, max, step, displayValue, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  displayValue: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono text-foreground">{label}</span>
        <span className="text-xs font-semibold bg-primary-soft text-primary px-2 py-0.5 rounded">
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary" // accent-primary tinge a bolinha nativa do slider da cor roxa padrão
      />
    </div>
  )
}
