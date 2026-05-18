import { useLanguage } from '../../context/LanguageContext';
import { Language } from '../../types';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'az', label: 'AZ' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
];

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex gap-1">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
            lang === l.code
              ? 'bg-gray-800 text-white'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
