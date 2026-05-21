import { createContext, useContext, useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';

export interface DateRange { startDate: string; endDate: string; }

const today = () => format(new Date(), 'yyyy-MM-dd');
const daysAgo = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd');

const KEY = 'ads_audit_date_range';

function load(): DateRange {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return { startDate: daysAgo(29), endDate: today() };
}

interface Ctx { range: DateRange; setRange: (r: DateRange) => void; }
const DateRangeContext = createContext<Ctx>({ range: load(), setRange: () => {} });

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRangeState] = useState<DateRange>(load);

  function setRange(r: DateRange) {
    setRangeState(r);
    localStorage.setItem(KEY, JSON.stringify(r));
  }

  useEffect(() => {
    const handler = () => setRangeState(load());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return <DateRangeContext.Provider value={{ range, setRange }}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() { return useContext(DateRangeContext); }
