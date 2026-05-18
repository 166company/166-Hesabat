import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import az from './az.json';
import ru from './ru.json';
import en from './en.json';

i18n.use(initReactI18next).init({
  resources: { az: { translation: az }, ru: { translation: ru }, en: { translation: en } },
  lng: localStorage.getItem('lang') || 'az',
  fallbackLng: 'az',
  interpolation: { escapeValue: false },
});

export default i18n;
