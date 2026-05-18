import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';

interface DataPoint {
  name: string;
  current: number;
  previous?: number;
}

interface Props {
  data: DataPoint[];
  metric: string;
  type?: 'area' | 'bar';
  primaryColor?: string;
  secondaryColor?: string;
  showPrevious?: boolean;
  valueFormatter?: (v: number) => string;
}

export default function ComparisonChart({
  data, metric, type = 'bar',
  primaryColor = '#4285F4', secondaryColor = '#FBBC04',
  showPrevious = false, valueFormatter,
}: Props) {
  const { t } = useTranslation();
  const fmt = valueFormatter || ((v: number) => v.toLocaleString('az-AZ', { maximumFractionDigits: 2 }));

  if (!data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-lg">
        {t('common.noData')}
      </div>
    );
  }

  const ChartComponent = type === 'area' ? AreaChart : BarChart;
  const DataComponent1 = type === 'area' ? Area : Bar;
  const DataComponent2 = type === 'area' ? Area : Bar;

  return (
    <ResponsiveContainer width="100%" height={220}>
      {type === 'area' ? (
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.15} />
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.15} />
              <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Verdana' }} />
          <YAxis tick={{ fontSize: 11, fontFamily: 'Verdana' }} tickFormatter={fmt} width={60} />
          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontFamily: 'Verdana', fontSize: 12 }} />
          {showPrevious && (
            <Legend wrapperStyle={{ fontFamily: 'Verdana', fontSize: 11 }} />
          )}
          <Area type="monotone" dataKey="current" name={t('common.current')} stroke={primaryColor} fill="url(#colorCurrent)" strokeWidth={2} dot={false} />
          {showPrevious && (
            <Area type="monotone" dataKey="previous" name={t('common.previous')} stroke={secondaryColor} fill="url(#colorPrev)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
          )}
        </AreaChart>
      ) : (
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Verdana' }} />
          <YAxis tick={{ fontSize: 11, fontFamily: 'Verdana' }} tickFormatter={fmt} width={60} />
          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontFamily: 'Verdana', fontSize: 12 }} />
          {showPrevious && <Legend wrapperStyle={{ fontFamily: 'Verdana', fontSize: 11 }} />}
          <Bar dataKey="current" name={t('common.current')} fill={primaryColor} radius={[3, 3, 0, 0]} />
          {showPrevious && (
            <Bar dataKey="previous" name={t('common.previous')} fill={secondaryColor} radius={[3, 3, 0, 0]} />
          )}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
