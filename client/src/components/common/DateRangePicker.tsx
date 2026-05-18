import { useState } from 'react';
import DatePicker from 'react-datepicker';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { useTranslation } from 'react-i18next';
import 'react-datepicker/dist/react-datepicker.css';

export interface DateRangeValue {
  startDate: string;
  endDate: string;
  prevStartDate?: string;
  prevEndDate?: string;
}

interface Props {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  onApply: () => void;
  accentColor?: string;
}

type Preset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

function fmt(d: Date) { return format(d, 'yyyy-MM-dd'); }

function calcPrev(start: string, end: string): { prevStartDate: string; prevEndDate: string } {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const pe = new Date(s.getTime() - 86400000);
  const ps = new Date(pe.getTime() - (diff - 1) * 86400000);
  return { prevStartDate: fmt(ps), prevEndDate: fmt(pe) };
}

export default function DateRangePicker({ value, onChange, onApply, accentColor = '#4285F4' }: Props) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>('last30');
  const [compare, setCompare] = useState(false);
  const today = new Date();

  const presets: { key: Preset; label: string }[] = [
    { key: 'today', label: t('dateRange.today') },
    { key: 'yesterday', label: t('dateRange.yesterday') },
    { key: 'last7', label: t('dateRange.last7Days') },
    { key: 'last30', label: t('dateRange.last30Days') },
    { key: 'thisMonth', label: t('dateRange.thisMonth') },
    { key: 'lastMonth', label: t('dateRange.lastMonth') },
    { key: 'thisYear', label: t('dateRange.thisYear') },
    { key: 'custom', label: t('dateRange.custom') },
  ];

  function applyPreset(p: Preset) {
    setPreset(p);
    let s: Date, e: Date;
    switch (p) {
      case 'today': s = e = today; break;
      case 'yesterday': s = e = subDays(today, 1); break;
      case 'last7': s = subDays(today, 6); e = today; break;
      case 'last30': s = subDays(today, 29); e = today; break;
      case 'thisMonth': s = startOfMonth(today); e = today; break;
      case 'lastMonth': { const lm = subMonths(today, 1); s = startOfMonth(lm); e = endOfMonth(lm); break; }
      case 'thisYear': s = startOfYear(today); e = today; break;
      default: return;
    }
    const sd = fmt(s), ed = fmt(e);
    const prev = compare ? calcPrev(sd, ed) : {};
    onChange({ startDate: sd, endDate: ed, ...prev });
  }

  const btnStyle = (active: boolean) =>
    `px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
      active ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
    }`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {presets.map((p) => (
          <button
            key={p.key}
            className={btnStyle(preset === p.key)}
            style={preset === p.key ? { backgroundColor: accentColor } : {}}
            onClick={() => applyPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">{t('dateRange.startDate')}</label>
            <DatePicker
              selected={new Date(value.startDate)}
              onChange={(d) => d && onChange({ ...value, startDate: fmt(d) })}
              dateFormat="dd.MM.yyyy"
              maxDate={new Date(value.endDate)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">{t('dateRange.endDate')}</label>
            <DatePicker
              selected={new Date(value.endDate)}
              onChange={(d) => d && onChange({ ...value, endDate: fmt(d) })}
              dateFormat="dd.MM.yyyy"
              minDate={new Date(value.startDate)}
              maxDate={today}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => {
              setCompare(e.target.checked);
              if (e.target.checked) {
                const prev = calcPrev(value.startDate, value.endDate);
                onChange({ ...value, ...prev });
              } else {
                onChange({ startDate: value.startDate, endDate: value.endDate });
              }
            }}
            className="rounded"
          />
          {t('dateRange.compare')}
        </label>
        <button
          onClick={onApply}
          className="px-4 py-1.5 text-xs text-white rounded-md transition-colors"
          style={{ backgroundColor: accentColor }}
        >
          {t('dateRange.apply')}
        </button>
      </div>
    </div>
  );
}
