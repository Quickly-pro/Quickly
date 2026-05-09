import { useMemo, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface SpreadsheetChartProps {
  data: { label: string; value: number }[];
  type: 'bar' | 'pie' | 'line';
  title: string;
  color: string;
  onRemove: () => void;
}

const CHART_COLORS = ['#f97316', '#84cc16', '#06b6d4', '#ef4444', '#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#6366f1'];

export default function SpreadsheetChart({ data, type, title, color, onRemove }: SpreadsheetChartProps) {
  const [expanded, setExpanded] = useState(true);

  const formattedData = useMemo(() => data.map((d, i) => ({
    ...d,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  })), [data]);

  if (!expanded) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center text-orange-500">
              <i className="ri-bar-chart-box-line" />
            </div>
            <span className="text-sm font-medium text-gray-700">{title}</span>
            <span className="text-xs text-gray-400">({data.length} datos)</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded(true)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
              <i className="ri-arrow-down-s-line" />
            </button>
            <button onClick={onRemove} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 rounded hover:bg-red-50">
              <i className="ri-close-line" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 flex items-center justify-center text-orange-500">
            <i className="ri-bar-chart-box-line" />
          </div>
          <span className="text-sm font-medium text-gray-700">{title}</span>
          <span className="text-xs text-gray-400">({data.length} datos)</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(false)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
            <i className="ri-arrow-up-s-line" />
          </button>
          <button onClick={onRemove} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 rounded hover:bg-red-50">
            <i className="ri-close-line" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        <ResponsiveContainer width="100%" height={280}>
          {type === 'bar' && (
            <BarChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                formatter={(v: number) => [v.toLocaleString('es-ES'), 'Valor']}
              />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
          {type === 'pie' && (
            <PieChart>
              <Pie
                data={formattedData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={40}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {formattedData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                formatter={(v: number, n: string) => [v.toLocaleString('es-ES'), n]}
              />
              <Legend fontSize={11} />
            </PieChart>
          )}
          {type === 'line' && (
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                formatter={(v: number) => [v.toLocaleString('es-ES'), 'Valor']}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: color, strokeWidth: 1, stroke: '#fff' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}