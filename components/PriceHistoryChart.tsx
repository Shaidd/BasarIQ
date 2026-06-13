'use client'

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

export type ChartPoint = {
  date: string
  price: number
  vendor: string
  freshness: 'fresh' | 'stale' | 'expired'
}

const FRESHNESS_COLOR: Record<ChartPoint['freshness'], string> = {
  fresh: '#22c55e',
  stale: '#eab308',
  expired: '#ef4444',
}

type DotProps = {
  cx?: number
  cy?: number
  payload?: ChartPoint
}

function ColoredDot({ cx = 0, cy = 0, payload }: DotProps) {
  if (!payload) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={FRESHNESS_COLOR[payload.freshness]}
      stroke="white"
      strokeWidth={1.5}
    />
  )
}

type TooltipPayload = { payload?: ChartPoint }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.[0]?.payload) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border rounded-lg shadow-sm p-2 text-xs space-y-0.5">
      <div className="font-medium">{d.vendor}</div>
      <div>₪{d.price.toFixed(2)}/kg</div>
      <div className="text-gray-400">
        {new Date(d.date).toLocaleDateString('en-IL', {
          day: 'numeric', month: 'short', year: '2-digit',
        })}
      </div>
    </div>
  )
}

export default function PriceHistoryChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm border rounded-xl bg-white">
        No price history yet — be the first to add one
      </div>
    )
  }

  const chartData = data
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, timestamp: new Date(d.date).getTime() }))

  const allPrices = chartData.map(d => d.price)
  const yMin = Math.max(0, Math.min(...allPrices) * 0.85)
  const yMax = Math.max(...allPrices) * 1.15

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            type="number"
            dataKey="timestamp"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={v =>
              new Date(v).toLocaleDateString('en-IL', { month: 'short', day: 'numeric' })
            }
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="price"
            domain={[yMin, yMax]}
            tickFormatter={v => `₪${v}`}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter
            data={chartData}
            shape={(props: DotProps) => <ColoredDot {...props} />}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="flex gap-4 justify-center text-xs text-gray-500">
        <span><span className="text-green-500 font-bold">●</span> Fresh (&le;7d)</span>
        <span><span className="text-yellow-500 font-bold">●</span> Stale (8–21d)</span>
        <span><span className="text-red-500 font-bold">●</span> Expired</span>
      </div>
    </div>
  )
}
