interface MetricsCardProps {
  label: string;
  value: string | number;
  previous?: string | number;
  prefix?: string;
  suffix?: string;
  color?: string;
}

function pctChange(current: number, previous: number): string {
  if (!previous) return '—';
  const pct = ((current - previous) / previous) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

export default function MetricsCard({ label, value, previous, prefix = '', suffix = '', color = '#4285F4' }: MetricsCardProps) {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
  const prevNum = previous !== undefined ? (typeof previous === 'string' ? parseFloat(previous) || 0 : previous) : undefined;
  const change = prevNum !== undefined ? pctChange(num, prevNum) : null;
  const isPositive = change && change.startsWith('+');
  const isNegative = change && change.startsWith('-');

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-800" style={{ color }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString('az-AZ', { maximumFractionDigits: 2 }) : value}{suffix}
      </div>
      {change && prevNum !== undefined && (
        <div className={`text-xs mt-1 font-medium ${isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-gray-400'}`}>
          {change} {prevNum !== 0 && <span className="text-gray-400 font-normal">(əvvəl: {prefix}{prevNum.toLocaleString('az-AZ', { maximumFractionDigits: 2 })}{suffix})</span>}
        </div>
      )}
    </div>
  );
}
