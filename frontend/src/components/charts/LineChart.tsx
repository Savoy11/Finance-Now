'use client'

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import type { ChartTooltipFormatter } from './tooltipTypes'
import { CHART_THEME } from '@/lib/utils/chart'

interface LineSeries {
  key: string
  label: string
  color: string
  strokeWidth?: number
  dashed?: boolean
}

interface LineChartProps {
  data: Record<string, unknown>[]
  series: LineSeries[]
  xKey: string
  xFormatter?: (value: unknown) => string
  yFormatter?: (value: unknown) => string
  tooltipFormatter?: ChartTooltipFormatter
  referenceLines?: { y: number; label?: string; color?: string }[]
  /** Spans of the x axis to shade, by x values present in `data` (T-464: stretches below zero). */
  referenceAreas?: { x1: string; x2: string; color?: string }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  /** Bridge gaps where a series has no value for a row (mixed-granularity data). */
  connectNulls?: boolean
  /**
   * The value axis's range. Left unset it starts at zero, which suits a share or a
   * yield; ['auto', 'auto'] fits it to the data, for a series such as an exchange
   * rate whose moves would look flat drawn from zero.
   */
  yDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax']
}

export function LineChart({
  data,
  series,
  xKey,
  xFormatter,
  yFormatter,
  tooltipFormatter,
  referenceLines,
  referenceAreas,
  height = 240,
  showGrid = true,
  showLegend = false,
  connectNulls = false,
  yDomain,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
        )}

        <XAxis
          dataKey={xKey}
          tick={{ fill: CHART_THEME.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={xFormatter}
          minTickGap={40}
        />

        <YAxis
          tick={{ fill: CHART_THEME.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={yFormatter}
          width={60}
          domain={yDomain}
        />

        <Tooltip
          contentStyle={{
            backgroundColor: CHART_THEME.tooltip.background,
            border: `1px solid ${CHART_THEME.tooltip.border}`,
            borderRadius: '6px',
            fontSize: '12px',
            color: CHART_THEME.tooltip.text,
          }}
          formatter={tooltipFormatter}
        />

        {showLegend && (
          <Legend wrapperStyle={{ fontSize: '12px', color: CHART_THEME.axis }} />
        )}

        {referenceAreas?.map((ra) => (
          <ReferenceArea
            key={`${ra.x1}-${ra.x2}`}
            x1={ra.x1}
            x2={ra.x2}
            fill={ra.color ?? '#ef4444'}
            fillOpacity={0.12}
            strokeOpacity={0}
          />
        ))}

        {referenceLines?.map((rl) => (
          <ReferenceLine
            key={rl.y}
            y={rl.y}
            stroke={rl.color ?? '#475569'}
            strokeDasharray="4 4"
          />
        ))}

        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={s.strokeWidth ?? 1.5}
            strokeDasharray={s.dashed ? '5 5' : undefined}
            dot={false}
            activeDot={{ r: 4, stroke: s.color, strokeWidth: 2, fill: '#1a1d26' }}
            isAnimationActive={false}
            connectNulls={connectNulls}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}
