'use client' // Necessário no Next.js para telas que lidam com clique, hooks de estado ou useEffect

// O React traz uma função 'use' especial para ler Promessas, como ler o ID da URL
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Pill } from '@/components/Pill'
import { ExperimentResults, type ExperimentMetrics } from '@/components/ExperimentResults'
import { TutorChat } from '@/components/TutorChat'
import { apiFetch } from '@/lib/api'

// Define a "Receita" de dados do experimento puxada do banco
interface Experiment {
  id: string
  name: string
  model_type: string
  dataset_name: string
  hyperparams: Record<string, unknown> // Dicionário flexível (ex: {"C": 1.0, "max_depth": 3})
  metrics: ExperimentMetrics // O mesmo formato esperado pelo nosso componente de Gráficos
  created_at: string
}

// Dicionário de tradução dos nomes técnicos dos algoritmos
const MODEL_LABELS: Record<string, string> = {
  linear_regression: 'Regressão Linear',
  logistic_regression: 'Regressão Logística',
  decision_tree: 'Árvore de Decisão',
  knn: 'KNN',
  random_forest: 'Random Forest',
}

// Mapeamento dos hiperparâmetros válidos para cada modelo
const ALLOWED_HYPERPARAMS: Record<string, string[]> = {
  linear_regression: ['test_size'],
  logistic_regression: ['test_size', 'C'],
  decision_tree: ['test_size', 'max_depth'],
  knn: ['test_size', 'n_neighbors'],
  random_forest: ['test_size', 'n_estimators', 'max_depth'],
}

/**
 * PÁGINA DE DETALHES DE UM EXPERIMENTO
 * A URL dela no navegador será algo como: /experiment/abc-123-xyz
 * O Next.js injeta a variável dinâmica 'params' contendo o id ('abc-123-xyz')
 */
export default function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Extrai o ID da URL
  const { id } = use(params)
  
  // Estados para gerenciar a requisição assíncrona
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Ao abrir a página, bate na API passando o UUID
  useEffect(() => {
    apiFetch(`/experiments/${id}/`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return } // 404 = Não encontrou
        if (r.ok) setExperiment(await r.json()) // Se foi Sucesso, guarda na memória
      })
      .finally(() => setLoading(false)) // Remove aviso de loading
  }, [id])

  // Botão Mágico: "Refazer este experimento" redirecionando pra tela de 'Novo', já com o dataset pré-selecionado na URL
  const repeatUrl = experiment
    ? `/experiments/new?dataset_name=${encodeURIComponent(experiment.dataset_name)}`
    : '/experiments/new'

  return (
    <AppShell>
      {/* Layout de Duas Colunas: Detalhes na esquerda, Chat com Tutor na direita */}
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-4rem)] overflow-hidden">
        
        {/* LADO ESQUERDO: RESULTADOS (Ocupa a maior parte da tela) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Cabecalho Simples com Botão Voltar */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold">
              {loading ? 'Carregando…' : experiment?.name ?? 'Experimento não encontrado'}
            </h1>
            
            {/* Etiquetas/Tags (Pills) ao lado do título */}
            {experiment && (
              <>
                <Pill variant="Model">{MODEL_LABELS[experiment.model_type] ?? experiment.model_type}</Pill>
                <Pill variant={experiment.metrics.task_type === 'classification' ? 'Classification' : 'Regression'}>
                  {experiment.metrics.task_type === 'classification' ? 'Classificação' : 'Regressão'}
                </Pill>
              </>
            )}
          </div>

          {/* Mensagens de Feedback enquanto a API não responde */}
          {loading && (
            <div className="text-center text-muted-foreground py-16">Carregando…</div>
          )}
          {notFound && (
            <div className="text-center text-muted-foreground py-16">Experimento não encontrado.</div>
          )}

          {/* Quando os dados estão carregados com sucesso */}
          {experiment && (
            <>
              {/* 1. Caixinha de Resumo dos Parâmetros Usados no Treino */}
              <div className="bg-card border border-border rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Configuração
                </h2>
                {/* dl = Description List, uma tag HTML perfeita pra dicionários */}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Dataset</dt>
                    <dd className="font-medium mt-0.5">{experiment.dataset_name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Modelo</dt>
                    <dd className="font-medium mt-0.5">{MODEL_LABELS[experiment.model_type] ?? experiment.model_type}</dd>
                  </div>
                  {/* Pega todos os campos dinâmicos de Hiperparâmetros (que variam de modelo pra modelo) e lista aqui */}
                  {Object.entries(experiment.hyperparams)
                    .filter(([k]) => ALLOWED_HYPERPARAMS[experiment.model_type]?.includes(k) ?? true)
                    .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground font-mono text-xs">{k}</dt>
                      <dd className="font-medium mt-0.5">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* 2. Chama nosso Componente Gráfico Central de Resultados */}
              <ExperimentResults metrics={experiment.metrics} />

              {/* 3. Rodapé com Botão de Repetir */}
              <div className="flex justify-end">
                <Link
                  href={repeatUrl}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Repetir com novos parâmetros
                </Link>
              </div>
            </>
          )}
        </div>

        {/* LADO DIREITO: TUTOR IA (Fica grudado no canto da tela) */}
        {experiment && (
          // shrink-0 garante que ele não será esmagado pela janela da esquerda
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l">
            {/* O Tutor precisa apenas do ID do experimento para se puxar o contexto lá no servidor Ollama */}
            <TutorChat experimentId={id} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
