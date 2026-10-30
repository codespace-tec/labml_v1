'use client' // Como essa tela busca dados quando carrega (useEffect), ela precisa ser Client Component

import { useEffect, useState } from 'react'
import Link from 'next/link'
// Ícones variados importados do pacote Lucide
import { Plus, Database, Calendar, FlaskConical, TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/AppShell' // Casca (Menu + Header)
import { Pill } from '@/components/Pill' // Mini-etiqueta colorida
import { MetricCard } from '@/components/MetricCard' // Cartão de números
import { Skeleton } from '@/components/ui/skeleton' // Barrinhas cinzas que piscam enquanto carrega
import { apiFetch } from '@/lib/api' // Nosso Fetch turbinado com Token

// Define a estrutura do JSON que vem do Django
interface Experiment {
  id: string
  name: string
  model_type: string
  dataset_name: string
  // A métrica varia (Accuracy se for classificação, R2 se for regressão)
  metrics_summary: { accuracy?: number; r2?: number }
  created_at: string
}

// Dicionário visual para traduzir o nome feio do banco para um nome bonito na tela
const MODEL_LABELS: Record<string, string> = {
  linear_regression: 'Reg. Linear',
  logistic_regression: 'Reg. Logística',
  decision_tree: 'Árvore',
  knn: 'KNN',
  random_forest: 'R. Forest',
}

/**
 * Função utilitária para converter a data do banco (ISO 8601) para padrão brasileiro (Ex: 10 de jan. de 2024)
 */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Tela do Dashboard (Painel Principal após o login)
 */
export default function DashboardPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)

  // Dispara assim que a tela abre pela primeira vez
  useEffect(() => {
    // Busca a lista de experimentos na API
    apiFetch('/experiments/')
      .then(r => r.ok ? r.json() : []) // Se der 200 OK, converte pra JSON, se não, retorna array vazio
      .then(setExperiments) // Salva na memória do React
      .finally(() => setLoading(false)) // Desliga a tela de carregamento (Skeleton)
  }, [])

  // Pega a data do experimento mais recente (o primeiro da lista, pois a API já traz ordenado por data)
  const lastDate = experiments[0] ? formatDate(experiments[0].created_at) : '—'

  return (
    // Envolve a página na 'Casca' para ter o menu lateral e superior
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        
        {/* Cabeçalho da página e Botão Novo */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Seus experimentos de machine learning.
            </p>
          </div>
          {/* O Link para a tela de criação novo experimento */}
          <Link
            href="/experiments/new"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo experimento
          </Link>
        </div>

        {/* Linha com os 3 cartões de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Experimentos" value={String(experiments.length)} tone="primary" />
          <MetricCard label="Datasets" value="—" tone="success" /> {/* Em breve, número de datasets */}
          <MetricCard label="Último treino" value={lastDate} tone="neutral" />
        </div>

        {/* Tabela de Experimentos Recentes */}
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold">Experimentos recentes</h2>
          </div>

          {/* Renderização Condicional Tripla: 
              1. Está carregando? (Skeleton)
              2. Veio vazio? (Aviso amigável de lista vazia)
              3. Tem itens? (Mostra a lista real) 
          */}
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <div className="flex gap-3">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-3 w-12 ml-auto" />
                    <Skeleton className="h-6 w-16 ml-auto" />
                  </div>
                  <Skeleton className="h-4 w-20 shrink-0" />
                </div>
              ))}
            </div>
          ) : experiments.length === 0 ? (
            // Empty State (Estado Vazio)
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <FlaskConical className="h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">Nenhum experimento ainda. Crie o primeiro!</p>
              <Link
                href="/experiments/new"
                className="text-sm text-primary hover:underline"
              >
                Criar experimento →
              </Link>
            </div>
          ) : (
            // Lista Real de Experimentos iterada com o método .map()
            <div className="divide-y divide-border">
              {experiments.map(exp => {
                // Descobre se a IA resolveu um problema de adivinhar Categoria (Classificação) ou Número (Regressão)
                const isClassification = 'accuracy' in exp.metrics_summary
                const metricLabel = isClassification ? 'Accuracy' : 'R²'
                
                // Formata o número (se for Accuracy exibe porcentagem, se for R2 mostra puro)
                const metricValue = isClassification
                  ? `${((exp.metrics_summary.accuracy ?? 0) * 100).toFixed(1)}%`
                  : String(exp.metrics_summary.r2 ?? '—')
                  
                const metricNum = isClassification ? (exp.metrics_summary.accuracy ?? 0) : (exp.metrics_summary.r2 ?? 0)
                
                // Define a cor da etiqueta (Verde, Laranja, Vermelho)
                const tone = metricNum >= 0.85 ? 'Good' : metricNum >= 0.7 ? 'Mid' : 'Bad'

                return (
                  <div key={exp.id} className="flex items-center gap-4 p-4">
                    
                    {/* Lado Esquerdo: Nome e Metadados */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{exp.name}</span>
                        {/* Exibe o nome do modelo (ex: Árvore de Decisão) formatado */}
                        <Pill variant="Model">{MODEL_LABELS[exp.model_type] ?? exp.model_type}</Pill>
                      </div>
                      
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {exp.dataset_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(exp.created_at)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Lado Direito: Nota/Score */}
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{metricLabel}</div>
                      <div className="text-lg font-bold flex items-center gap-2 justify-end">
                        {metricValue}
                        <Pill variant={tone}>
                          <TrendingUp className="h-3 w-3" />
                        </Pill>
                      </div>
                    </div>
                    
                    {/* Botão Ver Detalhes */}
                    <Link
                      href={`/experiment/${exp.id}`}
                      className="shrink-0 text-sm text-primary hover:underline"
                    >
                      Ver detalhes
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
