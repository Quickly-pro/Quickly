import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface LangOption {
  code: string;
  label: string;
  flag: string;
  nativeName: string;
}

export const LANGUAGES: LangOption[] = [
  { code: 'es', label: 'Español',    flag: '🇪🇸', nativeName: 'Español' },
  { code: 'en', label: 'English',    flag: '🇬🇧', nativeName: 'English' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷', nativeName: 'Français' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷', nativeName: 'Português' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱', nativeName: 'Nederlands' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱', nativeName: 'Polski' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷', nativeName: 'Türkçe' },
  { code: 'zh', label: '中文',        flag: '🇨🇳', nativeName: '中文' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', label: '한국어',      flag: '🇰🇷', nativeName: '한국어' },
  { code: 'hi', label: 'हिन्दी',      flag: '🇮🇳', nativeName: 'हिन्दी' },
  { code: 'ca', label: 'Català',     flag: '🏴', nativeName: 'Català' },
  { code: 'gl', label: 'Galego',     flag: '🏴', nativeName: 'Galego' },
  { code: 'eu', label: 'Euskera',    flag: '🏴', nativeName: 'Euskera' },
];

// Traducciones de la UI principal
const UI_TRANSLATIONS: Record<string, Record<string, string>> = {
  es: {
    dashboard: 'Dashboard', clients: 'Clientes', routes: 'Rutas', products: 'Productos',
    orders: 'Pedidos', invoicing: 'Facturación', deliverynotes: 'Albaranes',
    incidents: 'Incidencias', vehicles: 'Vehículos', map: 'Mapa de Envíos',
    routesheet: 'Hoja de Ruta', ordersheet: 'Hoja de Pedidos', schedule: 'Cuadrante',
    company: 'Empresa', employees: 'Empleados', fuel: 'Combustible',
    stats: 'Estadísticas', calendar: 'Calendario', timecontrol: 'Control Horario',
    chat: 'Chat', email: 'Correo', notifications: 'Notificaciones',
    documents: 'Documentos', spreadsheet: 'Hoja de Cálculo', assistant: 'Asistente IA',
    suggestions: 'Sugerencias', legal: 'Privacidad y Términos',
    settings: 'Configuración', profile: 'Perfil', logout: 'Cerrar sesión',
    search: 'Buscar...', managementPanel: 'Panel de Gestión',
  },
  en: {
    dashboard: 'Dashboard', clients: 'Clients', routes: 'Routes', products: 'Products',
    orders: 'Orders', invoicing: 'Invoicing', deliverynotes: 'Delivery Notes',
    incidents: 'Incidents', vehicles: 'Vehicles', map: 'Delivery Map',
    routesheet: 'Route Sheet', ordersheet: 'Order Sheet', schedule: 'Schedule',
    company: 'Company', employees: 'Employees', fuel: 'Fuel',
    stats: 'Statistics', calendar: 'Calendar', timecontrol: 'Time Tracking',
    chat: 'Chat', email: 'Email', notifications: 'Notifications',
    documents: 'Documents', spreadsheet: 'Spreadsheet', assistant: 'AI Assistant',
    suggestions: 'Suggestions', legal: 'Privacy & Terms',
    settings: 'Settings', profile: 'Profile', logout: 'Log out',
    search: 'Search...', managementPanel: 'Management Panel',
  },
  fr: {
    dashboard: 'Tableau de bord', clients: 'Clients', routes: 'Itinéraires', products: 'Produits',
    orders: 'Commandes', invoicing: 'Facturation', deliverynotes: 'Bons de livraison',
    incidents: 'Incidents', vehicles: 'Véhicules', map: 'Carte de livraison',
    routesheet: 'Feuille de route', ordersheet: 'Feuille de commandes', schedule: 'Planning',
    company: 'Entreprise', employees: 'Employés', fuel: 'Carburant',
    stats: 'Statistiques', calendar: 'Calendrier', timecontrol: 'Contrôle du temps',
    chat: 'Chat', email: 'Courrier', notifications: 'Notifications',
    documents: 'Documents', spreadsheet: 'Tableur', assistant: 'Assistant IA',
    suggestions: 'Suggestions', legal: 'Confidentialité',
    settings: 'Paramètres', profile: 'Profil', logout: 'Se déconnecter',
    search: 'Rechercher...', managementPanel: 'Panneau de gestion',
  },
  de: {
    dashboard: 'Dashboard', clients: 'Kunden', routes: 'Routen', products: 'Produkte',
    orders: 'Bestellungen', invoicing: 'Rechnungen', deliverynotes: 'Lieferscheine',
    incidents: 'Vorfälle', vehicles: 'Fahrzeuge', map: 'Lieferkarte',
    routesheet: 'Routenblatt', ordersheet: 'Bestellblatt', schedule: 'Dienstplan',
    company: 'Unternehmen', employees: 'Mitarbeiter', fuel: 'Kraftstoff',
    stats: 'Statistiken', calendar: 'Kalender', timecontrol: 'Zeiterfassung',
    chat: 'Chat', email: 'E-Mail', notifications: 'Benachrichtigungen',
    documents: 'Dokumente', spreadsheet: 'Tabelle', assistant: 'KI-Assistent',
    suggestions: 'Vorschläge', legal: 'Datenschutz',
    settings: 'Einstellungen', profile: 'Profil', logout: 'Abmelden',
    search: 'Suchen...', managementPanel: 'Verwaltungspanel',
  },
  it: {
    dashboard: 'Dashboard', clients: 'Clienti', routes: 'Percorsi', products: 'Prodotti',
    orders: 'Ordini', invoicing: 'Fatturazione', deliverynotes: 'DDT',
    incidents: 'Incidenti', vehicles: 'Veicoli', map: 'Mappa consegne',
    routesheet: 'Foglio percorso', ordersheet: 'Foglio ordini', schedule: 'Pianificazione',
    company: 'Azienda', employees: 'Dipendenti', fuel: 'Carburante',
    stats: 'Statistiche', calendar: 'Calendario', timecontrol: 'Controllo orario',
    chat: 'Chat', email: 'Email', notifications: 'Notifiche',
    documents: 'Documenti', spreadsheet: 'Foglio calcolo', assistant: 'Assistente IA',
    suggestions: 'Suggerimenti', legal: 'Privacy e Termini',
    settings: 'Impostazioni', profile: 'Profilo', logout: 'Esci',
    search: 'Cerca...', managementPanel: 'Pannello di gestione',
  },
  pt: {
    dashboard: 'Dashboard', clients: 'Clientes', routes: 'Rotas', products: 'Produtos',
    orders: 'Pedidos', invoicing: 'Faturação', deliverynotes: 'Guias de entrega',
    incidents: 'Incidentes', vehicles: 'Veículos', map: 'Mapa de entregas',
    routesheet: 'Folha de rota', ordersheet: 'Folha de pedidos', schedule: 'Escala',
    company: 'Empresa', employees: 'Funcionários', fuel: 'Combustível',
    stats: 'Estatísticas', calendar: 'Calendário', timecontrol: 'Controlo de horas',
    chat: 'Chat', email: 'Correio', notifications: 'Notificações',
    documents: 'Documentos', spreadsheet: 'Planilha', assistant: 'Assistente IA',
    suggestions: 'Sugestões', legal: 'Privacidade',
    settings: 'Configurações', profile: 'Perfil', logout: 'Sair',
    search: 'Pesquisar...', managementPanel: 'Painel de gestão',
  },
};

// Fallback to Spanish for missing translations
function getTranslation(lang: string, key: string): string {
  return UI_TRANSLATIONS[lang]?.[key] || UI_TRANSLATIONS['es'][key] || key;
}

interface LanguageContextValue {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string) => string;
  currentLang: LangOption;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('quickly_lang') || 'es');

  const setLang = useCallback((newLang: string) => {
    setLangState(newLang);
    localStorage.setItem('quickly_lang', newLang);
  }, []);

  const t = useCallback((key: string) => getTranslation(lang, key), [lang]);

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, currentLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider');
  return ctx;
}
