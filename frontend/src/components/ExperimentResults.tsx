'use client' // Indica que o código utiliza recursos do navegador (hooks, interatividade)

// Removemos a importação do Recharts pois todos os gráficos agora utilizam Plotly
import { MetricCard } from './MetricCard' // Pequeno card para destacar um único número (ex: 95%)
import dynamic from 'next/dynamic'
import {
  Tooltip as RadixTooltip,
  TooltipContent as RadixTooltipContent,
  TooltipProvider as RadixTooltipProvider,
  TooltipTrigger as RadixTooltipTrigger,
} from "@/components/ui/tooltip"

// Carrega o Plotly apenas no navegador (desliga o SSR do Next.js para esta biblioteca)
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-sm text-muted-foreground">Carregando gráfico...</div>
})

const PLOTLY3_R_COLORS = [
  '#e97efcff', '#dd2bfd', '#bf1cfd', '#981cfd', '#6b1cfb', '#3c19f0', '#1910d8', '#0508b8'
]

// Tipagem TypeScript para definir exatamente que chaves esperamos do Backend
// Para problemas de Classificação:
interface ClassificationMetrics {
  task_type: 'classification'
  accuracy: number
  confusion_matrix: number[][]
  classes: string[]
  classification_report: Record<string, Record<string, number>>
  roc_curves?: Record<string, {
    fpr: number[]
    tpr: number[]
    auc: number
  }>
  feature_importances?: Array<{ feature: string; importance: number }>
}

// Para problemas de Regressão Numérica:
interface RegressionMetrics {
  task_type: 'regression'
  r2: number
  mae: number
  rmse: number
  scatter_sample: Array<{ actual: number; predicted: number }>
  feature_importances?: Array<{ feature: string; importance: number }>
}

// Junta as duas num tipo genérico para as funções abaixo usarem
export type ExperimentMetrics = ClassificationMetrics | RegressionMetrics

/**
 * COMPONENTE PAI
 * Inspeciona as métricas vindas do Python e direciona para o componente visual correto 
 * dependendo de qual matemática ele utilizou.
 */
export function ExperimentResults({ metrics, datasetName }: { metrics: ExperimentMetrics; datasetName?: string }) {
  if (metrics.task_type === 'classification') return <ClassificationView metrics={metrics} datasetName={datasetName} />
  return <RegressionView metrics={metrics} datasetName={datasetName} />
}


/**
 * RENDERIZAÇÃO PARA RESULTADOS DE CLASSIFICAÇÃO (Achar categorias)
 */
function ClassificationView({ metrics, datasetName }: { metrics: ClassificationMetrics; datasetName?: string }) {
  const { accuracy, confusion_matrix, classes, classification_report, roc_curves } = metrics

  // Mapeia classes numéricas para termos legíveis se for o dataset de diabetes
  const isDiabetes = datasetName?.toLowerCase().includes('diabetes')
  const displayClasses = classes.map(cls => {
    const strCls = String(cls)
    if (isDiabetes && (strCls === '0' || strCls === '1')) {
      return strCls === '0' ? 'Saudável' : 'Diabético'
    }
    return strCls
  })

  // Descobre qual o número mais alto dentro da Matriz de Confusão, para podermos calcular as cores (opacity)
  const maxCell = Math.max(...confusion_matrix.flat(), 1)
  const weightedAvg = classification_report['weighted avg'] ?? {}

  // Prepara os dados pro formato exato exigido pelo componente gráfico BarChart
  const f1Data = classes.map((cls, idx) => ({
    class: displayClasses[idx],
    f1: Number((classification_report[cls]?.['f1-score'] ?? 0).toFixed(3)),
  }))

  return (
    <div className="space-y-6">
      {/* 1. Grade com os cards de métricas cruas formatados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Classes"
          value={String(classes.length)}
          tone="neutral"
          description="Quantidade de categorias ou rótulos distintos que o modelo foi treinado para identificar."
        />
        <MetricCard
          label="Acurácia"
          value={`${(accuracy * 100).toFixed(2)}%`}
          tone={accuracy > 0.85 ? 'success' : 'warning'} // Destaca em verde se for bom
          description="Proporção de previsões corretas em relação ao total de casos. Útil para entender a performance geral do modelo quando as classes estão equilibradas."
        />
        <MetricCard
          label="Precisão"
          value={`${((weightedAvg['precision'] ?? 0) * 100).toFixed(2)}%`}
          tone="neutral"
          description="Proporção de previsões positivas corretas. Mede a exatidão: das instâncias que o modelo classificou como positivas, quantas realmente eram positivas."
        />
        <MetricCard
          label="Sensibilidade (Recall)"
          value={`${((weightedAvg['recall'] ?? 0) * 100).toFixed(2)}%`}
          tone="neutral"
          description="Proporção de casos reais positivos identificados corretamente. Mede a sensibilidade: de todas as instâncias reais positivas, quantas o modelo conseguiu capturar."
        />
      </div>

      {/* 2. Visualizações com Plotly (Matriz de Confusão e Curva ROC) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap/Matriz de Confusão gerada dinamicamente pelo Plotly */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-5 overflow-hidden">
          <RadixTooltipProvider delayDuration={150}>
            <RadixTooltip>
              <RadixTooltipTrigger asChild>
                <div className="cursor-help group mb-4 inline-block">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">Matriz de confusão</h3>
                </div>
              </RadixTooltipTrigger>
              <RadixTooltipContent side="top" align="start" className="max-w-[320px] p-3 text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-md rounded-lg z-50">
                Exibe a distribuição de previsões corretas e incorretas para cada classe. As linhas mostram os valores reais (esperados) e as colunas mostram as previsões feitas pelo modelo.
              </RadixTooltipContent>
            </RadixTooltip>
          </RadixTooltipProvider>
          <div className="w-full flex justify-center">
            <Plot
              data={[
                {
                  z: confusion_matrix,
                  x: displayClasses,
                  y: displayClasses,
                  type: 'heatmap',
                  colorscale: PLOTLY3_R_COLORS.map((color, idx) => [idx / (PLOTLY3_R_COLORS.length - 1), color]) as any,
                  text: confusion_matrix.map(row => row.map(String)) as any,
                  texttemplate: '%{text}', // Exibe o valor numérico em cada quadrado
                  hoverinfo: 'x+y+z',
                  showscale: false // Esconde a barra de cores lateral para um design mais limpo
                }
              ]}
              layout={{
                margin: { t: 10, l: 100, b: 50, r: 10 },
                xaxis: { title: { text: 'Classe Predita' }, side: 'bottom', tickfont: { size: 11 } },
                yaxis: { title: { text: 'Classe Real' }, autorange: 'reversed', tickfont: { size: 11 } },
                width: Math.max(300, classes.length * 80 + 120),
                height: Math.max(300, classes.length * 60 + 100),
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { family: 'inherit', color: 'inherit' }
              }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </div>
        </div>

        {/* Curva ROC gerada pelo Plotly */}
        {roc_curves && Object.keys(roc_curves).length > 0 && (
          <div className="bg-card border border-border rounded-xl shadow-sm p-5 overflow-hidden flex flex-col justify-between">
            <RadixTooltipProvider delayDuration={150}>
              <RadixTooltip>
                <RadixTooltipTrigger asChild>
                  <div className="cursor-help group mb-4">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">Curva ROC</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Capacidade de discriminação do modelo nas diferentes classes (One-vs-Rest)
                    </p>
                  </div>
                </RadixTooltipTrigger>
                <RadixTooltipContent side="top" align="start" className="max-w-[320px] p-3 text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-md rounded-lg z-50">
                  Mapeia a Taxa de Verdadeiros Positivos contra a Taxa de Falsos Positivos sob diferentes limiares. O valor AUC (Área Sob a Curva) mede o quão bem o modelo distingue as classes (quanto mais próximo de 1.0, melhor).
                </RadixTooltipContent>
              </RadixTooltip>
            </RadixTooltipProvider>
            <div className="w-full flex justify-center">
              <Plot
                data={[
                  {
                    x: [0, 1],
                    y: [0, 1],
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    name: 'Aleatório (AUC = 0.5)',
                    line: {
                      dash: 'dash',
                      color: 'rgba(120, 120, 120, 0.5)',
                      width: 2
                    }
                  },
                  ...Object.entries(roc_curves).map(([className, curve], idx) => {
                    // Seleciona cores legíveis da paleta (evitando as muito claras do início)
                    const availableColors = PLOTLY3_R_COLORS.slice(4);
                    const color = availableColors[idx % availableColors.length];
                    return {
                      x: curve.fpr,
                      y: curve.tpr,
                      type: 'scatter' as const,
                      mode: 'lines' as const,
                      name: `${className} (AUC = ${curve.auc.toFixed(3)})`,
                      line: { width: 3, color }
                    };
                  })
                ]}
                layout={{
                  margin: { t: 10, l: 50, b: 60, r: 20 },
                  xaxis: { title: { text: 'Especificidade (Falsos Positivos)', font: { size: 11 } }, range: [-0.01, 1.02] },
                  yaxis: { title: { text: 'Sensibilidade/Recall', font: { size: 11 } }, range: [-0.01, 1.02] },
                  legend: { orientation: 'h', x: 0, y: -0.25, font: { size: 10 } },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { family: 'inherit', color: 'inherit' },
                  hovermode: 'closest',
                  width: 350,
                  height: 300
                }}
                config={{ displayModeBar: false, responsive: true }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Tabela clássica HTML com as estatísticas detalhadas de cada classe geradas no Python */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-5">
        <RadixTooltipProvider delayDuration={150}>
          <RadixTooltip>
            <RadixTooltipTrigger asChild>
              <div className="cursor-help group mb-4 inline-block">
                <h3 className="font-semibold group-hover:text-primary transition-colors">Relatório de Classificação</h3>
              </div>
            </RadixTooltipTrigger>
            <RadixTooltipContent side="top" align="start" className="max-w-[320px] p-3 text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-md rounded-lg z-50">
              Apresenta detalhadamente o desempenho por classe através das métricas Precisão, Recall e F1-score (uma média harmônica balanceada entre as duas), junto com o Suporte (número real de ocorrências de cada classe nos dados de teste).
            </RadixTooltipContent>
          </RadixTooltip>
        </RadixTooltipProvider>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="text-left pb-2 pr-4">Classe</th>
                <th className="text-right pb-2 pr-4">Precisão</th>
                <th className="text-right pb-2 pr-4">Recall</th>
                <th className="text-right pb-2 pr-4">F1-score</th>
                <th className="text-right pb-2">Suporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Gera as linhas da tabela pegando direto do dicionário do Python */}
              {classes.map((cls, idx) => {
                const row = classification_report[cls]
                if (!row) return null
                return (
                  <tr key={cls}>
                    <td className="py-2 pr-4 font-medium">{displayClasses[idx]}</td>
                    <td className="text-right py-2 pr-4 font-mono">{row['precision']?.toFixed(3)}</td>
                    <td className="text-right py-2 pr-4 font-mono">{row['recall']?.toFixed(3)}</td>
                    <td className="text-right py-2 pr-4 font-mono">{row['f1-score']?.toFixed(3)}</td>
                    <td className="text-right py-2 font-mono">{row['support']}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Gráfico de barras horizontal demonstrando a pontuação das classes */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-5">
        <RadixTooltipProvider delayDuration={150}>
          <RadixTooltip>
            <RadixTooltipTrigger asChild>
              <div className="cursor-help group mb-4 inline-block">
                <h3 className="font-semibold group-hover:text-primary transition-colors">F1-score por classe</h3>
              </div>
            </RadixTooltipTrigger>
            <RadixTooltipContent side="top" align="start" className="max-w-[320px] p-3 text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-md rounded-lg z-50">
              Representação visual do F1-score de cada classe. Ajuda a comparar facilmente quais classes o modelo consegue prever com maior facilidade e quais apresentam menor precisão ou sensibilidade.
            </RadixTooltipContent>
          </RadixTooltip>
        </RadixTooltipProvider>
        <div className="w-full flex justify-center">
          <Plot
            data={[
              {
                x: f1Data.map(d => d.f1),
                y: f1Data.map(d => d.class),
                type: 'bar',
                orientation: 'h',
                marker: {
                  color: f1Data.map((_, idx) => PLOTLY3_R_COLORS[idx % PLOTLY3_R_COLORS.length])
                },
                hovertemplate: 'F1-score: %{x:.3f}<extra></extra>'
              }
            ]}
            layout={{
              margin: { t: 10, l: 100, b: 40, r: 20 },
              xaxis: { range: [0, 1], tickfont: { size: 11 } },
              yaxis: { tickfont: { size: 12 } },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { family: 'inherit', color: 'inherit' },
              height: Math.max(160, classes.length * 48),
              autosize: true
            }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      </div>
      {metrics.feature_importances && metrics.feature_importances.length > 0 && (
        <FeatureImportancesSection importances={metrics.feature_importances} />
      )}
    </div>
  )
}

/**
 * RENDERIZAÇÃO PARA RESULTADOS DE REGRESSÃO (Adivinhar números como preços)
 */
function RegressionView({ metrics, datasetName }: { metrics: RegressionMetrics; datasetName?: string }) {
  const { r2, mae, rmse, scatter_sample = [] } = metrics

  // Extrai todos os valores possíveis para calcular onde o plano cartesiano do gráfico tem que começar e terminar
  const values = scatter_sample.flatMap(d => [d.actual, d.predicted])
  const minVal = values.length ? Math.min(...values) : 0
  const maxVal = values.length ? Math.max(...values) : 1

  // Função para calcular a Linha de Regressão (Tendência Geral) usando Mínimos Quadrados Simples
  const calculateRegressionLine = (data: Array<{ actual: number; predicted: number }>) => {
    if (data.length < 2) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = data.length;
    for (const point of data) {
      sumX += point.actual;
      sumY += point.predicted;
      sumXY += point.actual * point.predicted;
      sumXX += point.actual * point.actual;
    }
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }

  const regression = calculateRegressionLine(scatter_sample);
  const trendPoints = regression ? {
    x: [minVal, maxVal],
    y: [regression.slope * minVal + regression.intercept, regression.slope * maxVal + regression.intercept]
  } : null;

  return (
    <div className="space-y-6">
      {/* Destaca a métrica R² que é a mais vital nesta tarefa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="R²"
          value={String(r2)}
          tone={r2 > 0.7 ? 'success' : 'warning'}
          description="Coeficiente de Determinação. Representa a proporção da variabilidade dos dados que é explicada pelo modelo. Varia de -∞ a 1, onde 1 indica ajuste perfeito."
        />
        <MetricCard
          label="MAE"
          value={String(mae)}
          tone="neutral"
          description="Erro Médio Absoluto. Média das diferenças absolutas entre as previsões e os valores reais. Mostra o desvio médio esperado nas previsões (na mesma escala dos dados)."
        />
        <MetricCard
          label="RMSE"
          value={String(rmse)}
          tone="neutral"
          description="Raiz do Erro Quadrático Médio. Mede a magnitude média do erro, penalizando desvios maiores com mais força. Útil para identificar a presença de outliers com grandes erros."
        />
      </div>

      {/* Se houver amostras (samples), exibe um gráfico de pontilhados (dispersão) */}
      {scatter_sample.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-5 overflow-hidden">
          <RadixTooltipProvider delayDuration={150}>
            <RadixTooltip>
              <RadixTooltipTrigger asChild>
                <div className="cursor-help group mb-4 inline-block">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">Valores reais vs. preditos</h3>
                </div>
              </RadixTooltipTrigger>
              <RadixTooltipContent side="top" align="start" className="max-w-[340px] p-3 text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-md rounded-lg z-50">
                Gráfico de dispersão que compara as previsões feitas pelo modelo com os valores reais. A linha tracejada cinza representa a predição ideal (Identidade: y = x). A linha sólida azul escuro mostra a tendência média das previsões do modelo (calculada por regressão linear).
              </RadixTooltipContent>
            </RadixTooltip>
          </RadixTooltipProvider>
          <div className="w-full flex justify-center">
            <Plot
              data={[
                {
                  x: [minVal, maxVal],
                  y: [minVal, maxVal],
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  name: 'Predição Perfeita (y = x)',
                  showlegend: false,
                  line: {
                    dash: 'dash',
                    color: 'rgba(120, 120, 120, 0.6)',
                    width: 2
                  }
                },
                ...(trendPoints ? [{
                  x: trendPoints.x,
                  y: trendPoints.y,
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  name: 'Tendência do Modelo (Ajuste)',
                  line: {
                    color: '#1910d8',
                    width: 2.5
                  }
                }] : []),
                {
                  x: scatter_sample.map(d => d.actual),
                  y: scatter_sample.map(d => d.predicted),
                  type: 'scatter' as const,
                  mode: 'markers' as const,
                  name: 'Amostras',
                  marker: {
                    color: '#6b1cfb',
                    opacity: 0.6,
                    size: 8
                  }
                }
              ]}
              layout={{
                margin: { t: 10, l: 60, b: 60, r: 20 },
                xaxis: { title: { text: 'Valor Real', font: { size: 11 } } },
                yaxis: { title: { text: 'Valor Predito', font: { size: 11 } } },
                legend: { orientation: 'h', x: 0, y: -0.25, font: { size: 10 } },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { family: 'inherit', color: 'inherit' },
                hovermode: 'closest',
                width: 500,
                height: 400
              }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </div>
        </div>
      )}
      {metrics.feature_importances && metrics.feature_importances.length > 0 && (
        <FeatureImportancesSection importances={metrics.feature_importances} />
      )}
    </div>
  )
}

/**
 * Seção para exibir a importância das variáveis/features nos modelos de árvore (ex: Random Forest).
 */
function FeatureImportancesSection({ importances }: { importances: Array<{ feature: string; importance: number }> }) {
  const sortedImportances = [...importances].sort((a, b) => a.importance - b.importance);

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5">
      <RadixTooltipProvider delayDuration={150}>
        <RadixTooltip>
          <RadixTooltipTrigger asChild>
            <div className="cursor-help group mb-4 inline-block">
              <h3 className="font-semibold group-hover:text-primary transition-colors">Importância dos Indicadores</h3>
            </div>
          </RadixTooltipTrigger>
          <RadixTooltipContent side="top" align="start" className="max-w-[320px] p-3 text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-md rounded-lg z-50">
            Mede a contribuição ou o impacto relativo de cada variável (coluna) para as previsões do modelo. Valores maiores indicam que a variável tem maior influência nas decisões do algoritmo.
          </RadixTooltipContent>
        </RadixTooltip>
      </RadixTooltipProvider>
      <div className="w-full flex justify-center">
        <Plot
          data={[
            {
              x: sortedImportances.map(d => d.importance),
              y: sortedImportances.map(d => d.feature),
              type: 'bar',
              orientation: 'h',
              marker: {
                color: sortedImportances.map((_, idx) => PLOTLY3_R_COLORS[idx % PLOTLY3_R_COLORS.length])
              },
              hovertemplate: 'Importância: %{x:.2%}<extra></extra>'
            }
          ]}
          layout={{
            margin: { t: 10, l: 120, b: 40, r: 20 },
            xaxis: { tickformat: '.0%', tickfont: { size: 11 } },
            yaxis: { tickfont: { size: 12 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { family: 'inherit', color: 'inherit' },
            height: Math.max(160, sortedImportances.length * 40),
            autosize: true
          }}
          config={{ displayModeBar: false, responsive: true }}
        />
      </div>
    </div>
  )
}
