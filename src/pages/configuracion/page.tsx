import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClickOutside } from '@/hooks/useClickOutside';
import Modal from '@/components/base/Modal';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// ─── Opciones de localización ──────────────────────────────────────────────

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ca', label: 'Català' },
  { value: 'gl', label: 'Galego' },
  { value: 'eu', label: 'Euskera' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'ro', label: 'Română' },
  { value: 'ru', label: 'Русский' },
  { value: 'uk', label: 'Українська' },
  { value: 'ar', label: 'العربية' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'zh', label: '中文 (简体)' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'sw', label: 'Kiswahili' },
];

const CURRENCIES = [
  { value: 'EUR', label: 'EUR — € Euro' },
  { value: 'USD', label: 'USD — $ Dólar US' },
  { value: 'GBP', label: 'GBP — £ Libra esterlina' },
  { value: 'JPY', label: 'JPY — ¥ Yen japonés' },
  { value: 'CAD', label: 'CAD — $ Dólar canadiense' },
  { value: 'AUD', label: 'AUD — $ Dólar australiano' },
  { value: 'CHF', label: 'CHF — Fr Franco suizo' },
  { value: 'CNY', label: 'CNY — ¥ Yuan chino' },
  { value: 'SEK', label: 'SEK — kr Corona sueca' },
  { value: 'NOK', label: 'NOK — kr Corona noruega' },
  { value: 'DKK', label: 'DKK — kr Corona danesa' },
  { value: 'BRL', label: 'BRL — R$ Real brasileño' },
  { value: 'MXN', label: 'MXN — $ Peso mexicano' },
  { value: 'ARS', label: 'ARS — $ Peso argentino' },
  { value: 'COP', label: 'COP — $ Peso colombiano' },
  { value: 'CLP', label: 'CLP — $ Peso chileno' },
  { value: 'PEN', label: 'PEN — S/ Sol peruano' },
  { value: 'VES', label: 'VES — Bs Bolívar venezolano' },
  { value: 'INR', label: 'INR — ₹ Rupia india' },
  { value: 'SAR', label: 'SAR — ﷼ Riyal saudí' },
  { value: 'AED', label: 'AED — د.إ Dírham EAU' },
  { value: 'MAD', label: 'MAD — د.م. Dírham marroquí' },
  { value: 'ZAR', label: 'ZAR — R Rand sudafricano' },
  { value: 'NGN', label: 'NGN — ₦ Naira nigeriana' },
  { value: 'KES', label: 'KES — Ksh Chelín keniano' },
  { value: 'TRY', label: 'TRY — ₺ Lira turca' },
  { value: 'PLN', label: 'PLN — zł Esloti polaco' },
  { value: 'RON', label: 'RON — lei Leu rumano' },
  { value: 'HUF', label: 'HUF — Ft Forinto húngaro' },
  { value: 'CZK', label: 'CZK — Kč Corona checa' },
];

const TIMEZONES = [
  { group: 'Europa', options: [
    { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
    { value: 'Europe/London', label: 'Londres (GMT/BST)' },
    { value: 'Europe/Paris', label: 'París (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlín (CET/CEST)' },
    { value: 'Europe/Rome', label: 'Roma (CET/CEST)' },
    { value: 'Europe/Lisbon', label: 'Lisboa (WET/WEST)' },
    { value: 'Europe/Amsterdam', label: 'Ámsterdam (CET/CEST)' },
    { value: 'Europe/Brussels', label: 'Bruselas (CET/CEST)' },
    { value: 'Europe/Warsaw', label: 'Varsovia (CET/CEST)' },
    { value: 'Europe/Bucharest', label: 'Bucarest (EET/EEST)' },
    { value: 'Europe/Athens', label: 'Atenas (EET/EEST)' },
    { value: 'Europe/Helsinki', label: 'Helsinki (EET/EEST)' },
    { value: 'Europe/Stockholm', label: 'Estocolmo (CET/CEST)' },
    { value: 'Europe/Oslo', label: 'Oslo (CET/CEST)' },
    { value: 'Europe/Copenhagen', label: 'Copenhague (CET/CEST)' },
    { value: 'Europe/Zurich', label: 'Zúrich (CET/CEST)' },
    { value: 'Europe/Moscow', label: 'Moscú (MSK)' },
    { value: 'Europe/Istanbul', label: 'Estambul (TRT)' },
  ]},
  { group: 'América', options: [
    { value: 'America/New_York', label: 'Nueva York (EST/EDT)' },
    { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
    { value: 'America/Denver', label: 'Denver (MST/MDT)' },
    { value: 'America/Los_Angeles', label: 'Los Ángeles (PST/PDT)' },
    { value: 'America/Anchorage', label: 'Anchorage (AKST)' },
    { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
    { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)' },
    { value: 'America/Mexico_City', label: 'Ciudad de México (CST/CDT)' },
    { value: 'America/Bogota', label: 'Bogotá (COT)' },
    { value: 'America/Lima', label: 'Lima (PET)' },
    { value: 'America/Santiago', label: 'Santiago (CLT/CLST)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT/BRST)' },
    { value: 'America/Caracas', label: 'Caracas (VET)' },
    { value: 'America/Havana', label: 'La Habana (CST/CDT)' },
    { value: 'America/Santo_Domingo', label: 'Santo Domingo (AST)' },
  ]},
  { group: 'África', options: [
    { value: 'Africa/Cairo', label: 'El Cairo (EET)' },
    { value: 'Africa/Casablanca', label: 'Casablanca (WET/WEST)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburgo (SAST)' },
    { value: 'Africa/Algiers', label: 'Argel (CET)' },
    { value: 'Africa/Tunis', label: 'Túnez (CET)' },
  ]},
  { group: 'Asia', options: [
    { value: 'Asia/Dubai', label: 'Dubái (GST)' },
    { value: 'Asia/Riyadh', label: 'Riad (AST)' },
    { value: 'Asia/Tehran', label: 'Teherán (IRST)' },
    { value: 'Asia/Karachi', label: 'Karachi (PKT)' },
    { value: 'Asia/Kolkata', label: 'Calcuta (IST)' },
    { value: 'Asia/Dhaka', label: 'Daca (BST)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
    { value: 'Asia/Singapore', label: 'Singapur (SGT)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Shanghai', label: 'Shanghái (CST)' },
    { value: 'Asia/Tokyo', label: 'Tokio (JST)' },
    { value: 'Asia/Seoul', label: 'Seúl (KST)' },
    { value: 'Asia/Jakarta', label: 'Yakarta (WIB)' },
    { value: 'Asia/Taipei', label: 'Taipéi (CST)' },
    { value: 'Asia/Beirut', label: 'Beirut (EET/EEST)' },
    { value: 'Asia/Yekaterinburg', label: 'Ekaterimburgo (YEKT)' },
  ]},
  { group: 'Oceanía', options: [
    { value: 'Australia/Sydney', label: 'Sídney (AEST/AEDT)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
    { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
    { value: 'Pacific/Honolulu', label: 'Honolulu (HST)' },
    { value: 'Pacific/Fiji', label: 'Fiyi (FJT)' },
  ]},
];

interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastSeen: string;
  current: boolean;
}

export default function Configuracion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();

  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsAlerts: false,
    weeklyReport: true,
    autoAssignRoutes: false,
    language: localStorage.getItem('quickly_lang') || 'es',
    currency: localStorage.getItem('quickly_currency') || 'EUR',
    timezone: localStorage.getItem('quickly_timezone') || 'Europe/Madrid',
    pushNotifications: true,
    soundAlerts: true,
  });

  const [saved, setSaved] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // 2FA
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [mfaStep, setMfaStep] = useState<'enroll' | 'verify' | 'done'>('enroll');
  const [mfaQR, setMfaQR] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Session history
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const logoutRef = useRef<HTMLDivElement>(null);
  useClickOutside(logoutRef, () => setShowLogoutConfirm(false), showLogoutConfirm);

  // Check 2FA status on mount
  useEffect(() => {
    const check2FA = async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const hasTotp = data?.totp?.some(f => f.status === 'verified');
        setMfaEnabled(!!hasTotp);
      } catch { /* ignore */ }
    };
    if (user) check2FA();
  }, [user]);

  const toggle = (key: keyof typeof settings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  };

  const handleSave = () => {
    // Persistir preferencias regionales
    localStorage.setItem('quickly_lang', settings.language);
    localStorage.setItem('quickly_currency', settings.currency);
    localStorage.setItem('quickly_timezone', settings.timezone);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
  };

  const handleExport = async (type: string) => {
    setExporting(type);
    setTimeout(() => {
      setExporting(null);
      setShowExportModal(false);
    }, 1500);
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess(false);
    if (!passwordForm.new || !passwordForm.confirm) {
      setPasswordError('Todos los campos son obligatorios');
      return;
    }
    if (passwordForm.new.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
    setChangingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setPasswordSuccess(true);
    setPasswordForm({ current: '', new: '', confirm: '' });
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordSuccess(false);
    }, 2000);
  };

  // ── 2FA: Iniciar enrolamiento ──
  const handle2FAEnroll = async () => {
    setMfaLoading(true);
    setMfaError('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) { setMfaError(error.message); return; }
      if (data?.totp) {
        setMfaQR(data.totp.qr_code);
        setMfaSecret(data.totp.secret);
        setMfaFactorId(data.id);
        setMfaStep('verify');
      }
    } catch (e: any) {
      setMfaError(e.message || 'Error al configurar 2FA');
    } finally {
      setMfaLoading(false);
    }
  };

  // ── 2FA: Verificar código ──
  const handle2FAVerify = async () => {
    if (!mfaCode || mfaCode.length < 6) {
      setMfaError('Introduce el código de 6 dígitos');
      return;
    }
    setMfaLoading(true);
    setMfaError('');
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeErr) { setMfaError(challengeErr.message); return; }

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });

      if (verifyErr) { setMfaError('Código incorrecto. Inténtalo de nuevo.'); return; }

      setMfaStep('done');
      setMfaEnabled(true);
    } catch (e: any) {
      setMfaError(e.message || 'Error al verificar');
    } finally {
      setMfaLoading(false);
    }
  };

  // ── 2FA: Desactivar ──
  const handle2FADisable = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      for (const factor of data?.totp || []) {
        if (factor.status === 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      setMfaEnabled(false);
      setShow2FAModal(false);
    } catch (e: any) {
      setMfaError(e.message || 'Error al desactivar 2FA');
    }
  };

  // ── Session history ──
  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const ua = navigator.userAgent;
      const getBrowser = () => {
        if (ua.includes('Edg/')) return 'Microsoft Edge';
        if (ua.includes('Chrome/') && !ua.includes('Chromium')) return 'Google Chrome';
        if (ua.includes('Firefox/')) return 'Mozilla Firefox';
        if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Apple Safari';
        if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
        return 'Navegador desconocido';
      };
      const getOS = () => {
        if (ua.includes('Windows NT')) return 'Windows';
        if (ua.includes('Mac OS X')) return 'macOS';
        if (ua.includes('Linux') && !ua.includes('Android')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return 'Sistema desconocido';
      };

      const currentSession: SessionInfo = {
        id: session?.access_token?.slice(-8) || 'current',
        device: /Mobi|Android/i.test(ua) ? 'Dispositivo móvil' : 'Ordenador',
        browser: getBrowser(),
        os: getOS(),
        ip: '—',
        location: '—',
        lastSeen: 'Ahora mismo',
        current: true,
      };

      // Sesiones anteriores guardadas en localStorage
      const stored = JSON.parse(localStorage.getItem('quickly_sessions') || '[]');
      setSessions([currentSession, ...stored.slice(0, 4)]);

      // Guardar sesión actual para futura referencia
      const sessionRecord = {
        id: currentSession.id,
        device: currentSession.device,
        browser: currentSession.browser,
        os: currentSession.os,
        ip: '—',
        location: '—',
        lastSeen: new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        current: false,
      };
      const existing = stored.filter((s: any) => s.id !== currentSession.id);
      localStorage.setItem('quickly_sessions', JSON.stringify([sessionRecord, ...existing].slice(0, 5)));

    } catch { /* ignore */ } finally {
      setLoadingSessions(false);
    }
  };

  const SectionTitle = ({ title, desc }: { title: string; desc: string }) => (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{desc}</p>
    </div>
  );

  const Toggle = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700 dark:text-slate-200">{label}</span>
      <button onClick={onClick} className={`w-11 h-6 rounded-full transition-all relative ${active ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${active ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Configuración</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Personaliza tu experiencia en Quickly</p>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
        <SectionTitle title="Notificaciones" desc="Elige qué alertas quieres recibir" />
        <Toggle label="Notificaciones por email" active={settings.emailNotifications} onClick={() => toggle('emailNotifications')} />
        <Toggle label="Alertas SMS" active={settings.smsAlerts} onClick={() => toggle('smsAlerts')} />
        <Toggle label="Notificaciones push en navegador" active={settings.pushNotifications} onClick={() => toggle('pushNotifications')} />
        <Toggle label="Sonidos de alerta" active={settings.soundAlerts} onClick={() => toggle('soundAlerts')} />
        <Toggle label="Resumen semanal" active={settings.weeklyReport} onClick={() => toggle('weeklyReport')} />
      </div>

      {/* Automation */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
        <SectionTitle title="Automatización" desc="Configura procesos automáticos" />
        <Toggle label="Asignación automática de rutas" active={settings.autoAssignRoutes} onClick={() => toggle('autoAssignRoutes')} />
      </div>

      {/* Regional — international */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-4">
        <SectionTitle title="Región y Preferencias" desc="Ajusta idioma, moneda y zona horaria — disponible en todo el mundo" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Language */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">
              <i className="ri-global-line mr-1" />
              Idioma / Language
            </label>
            <select
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          {/* Currency */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">
              <i className="ri-money-euro-circle-line mr-1" />
              Moneda / Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            >
              {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Timezone */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">
              <i className="ri-time-zone-line mr-1" />
              Zona horaria / Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            >
              {TIMEZONES.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          <i className="ri-earth-line mr-1" />
          Quickly está disponible en todo el mundo. Los cambios se aplican al guardar.
        </p>
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
        <SectionTitle title="Apariencia" desc="Personaliza el aspecto visual de la app" />
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              {isDark ? <i className="ri-sun-line text-amber-500 text-lg" /> : <i className="ri-moon-line text-slate-600 text-lg" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                {isDark ? 'Modo oscuro activo' : 'Modo claro activo'}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {isDark ? 'Haz clic para volver al modo claro' : 'Haz clic para activar el modo oscuro'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`w-12 h-7 rounded-full transition-all relative ${isDark ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-700'}`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${isDark ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-3">
        <SectionTitle title="Datos y Exportación" desc="Exporta tus datos o solicita una copia de seguridad" />
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <i className="ri-file-download-line text-blue-600 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Exportar datos</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Descarga tus clientes, pedidos, facturas y rutas</p>
            </div>
          </div>
          <button onClick={() => setShowExportModal(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-all whitespace-nowrap">
            Exportar
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-3">
        <SectionTitle title="Seguridad" desc="Gestión de contraseña, autenticación de dos factores y sesiones" />

        {/* Change password */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <i className="ri-shield-keyhole-line text-slate-600 dark:text-slate-300 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Cambiar contraseña</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Actualiza tu clave de acceso</p>
            </div>
          </div>
          <button onClick={() => setShowPasswordModal(true)} className="px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-all whitespace-nowrap">
            Cambiar
          </button>
        </div>

        {/* 2FA */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${mfaEnabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'} flex items-center justify-center`}>
              <i className={`ri-smartphone-line text-lg ${mfaEnabled ? 'text-green-600' : 'text-emerald-600'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Autenticación en dos pasos (2FA)</p>
                {mfaEnabled && <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded">ACTIVO</span>}
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {mfaEnabled ? 'Tu cuenta está protegida con 2FA via app autenticadora' : 'Añade una capa extra de seguridad con una app autenticadora'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShow2FAModal(true); setMfaStep(mfaEnabled ? 'done' : 'enroll'); setMfaError(''); setMfaCode(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${mfaEnabled ? 'border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
          >
            {mfaEnabled ? 'Gestionar' : 'Activar'}
          </button>
        </div>

        {/* Session history */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <i className="ri-history-line text-amber-600 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Historial de sesiones</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Dispositivos con acceso activo y sesiones recientes</p>
            </div>
          </div>
          <button
            onClick={() => { setShowSessionsModal(true); loadSessions(); }}
            className="px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-all whitespace-nowrap"
          >
            Ver sesiones
          </button>
        </div>
      </div>

      {/* Account */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-3">
        <SectionTitle title="Cuenta" desc="Gestión de acceso a tu cuenta" />
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <i className="ri-logout-box-r-line text-red-500 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Cerrar sesión</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Salir de tu cuenta</p>
            </div>
          </div>
          <button onClick={() => setShowLogoutConfirm(true)} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all whitespace-nowrap">
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-100 dark:border-red-900/30 p-6">
        <h3 className="text-sm font-semibold text-red-600 mb-1">Zona de peligro</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Acciones irreversibles para tu cuenta</p>
        <button className="px-4 py-2 text-sm text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
          Cerrar mi cuenta
        </button>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pb-6">
        <button onClick={handleSave} className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2">
          {saved ? <i className="ri-check-line" /> : <i className="ri-save-line" />}
          {saved ? 'Guardado' : 'Guardar configuración'}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1"><i className="ri-check-double-line" />Configuración guardada</span>}
      </div>

      {/* ── Export Modal ────────────────────────────────────────────── */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Exportar datos" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-slate-400">Selecciona los datos que quieres descargar:</p>
          {[
            { key: 'clients', label: 'Clientes', icon: 'ri-user-3-line' },
            { key: 'orders', label: 'Pedidos', icon: 'ri-shopping-cart-2-line' },
            { key: 'invoices', label: 'Facturas', icon: 'ri-bill-line' },
            { key: 'routes', label: 'Rutas', icon: 'ri-map-2-line' },
            { key: 'employees', label: 'Empleados', icon: 'ri-team-line' },
          ].map((item) => (
            <button key={item.key} onClick={() => handleExport(item.key)} disabled={exporting !== null}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all text-left">
              <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <i className={`${item.icon} text-orange-600 dark:text-orange-400`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200">{item.label}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Descargar como CSV</p>
              </div>
              {exporting === item.key ? (
                <div className="w-4 h-4 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              ) : (
                <i className="ri-download-line text-gray-400 dark:text-slate-500" />
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* ── Change Password Modal ───────────────────────────────────── */}
      <Modal isOpen={showPasswordModal} onClose={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(false); setPasswordForm({ current: '', new: '', confirm: '' }); }} title="Cambiar contraseña" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Contraseña actual</label>
            <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" placeholder="••••••••" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Nueva contraseña</label>
            <input type="password" value={passwordForm.new} onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Confirmar nueva contraseña</label>
            <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" placeholder="Repite la nueva contraseña" />
          </div>
          {passwordError && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg text-sm text-red-600 dark:text-red-400"><i className="ri-error-warning-line mr-1" />{passwordError}</div>}
          {passwordSuccess && <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-lg text-sm text-green-600 dark:text-green-400"><i className="ri-check-line mr-1" />Contraseña actualizada correctamente</div>}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordForm({ current: '', new: '', confirm: '' }); }}
              className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 whitespace-nowrap">Cancelar</button>
            <button onClick={handlePasswordChange} disabled={passwordSuccess || changingPassword}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap flex items-center gap-2">
              {changingPassword && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {changingPassword ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 2FA Modal ───────────────────────────────────────────────── */}
      <Modal isOpen={show2FAModal} onClose={() => { setShow2FAModal(false); setMfaStep('enroll'); setMfaError(''); setMfaCode(''); }} title="Autenticación en dos pasos" size="sm">
        {mfaStep === 'enroll' && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto">
              <i className="ri-shield-check-line text-emerald-600 text-3xl" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-1">Protege tu cuenta con 2FA</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Necesitarás una app autenticadora como Google Authenticator, Authy o Microsoft Authenticator.</p>
            </div>
            {mfaError && <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">{mfaError}</div>}
            <button onClick={handle2FAEnroll} disabled={mfaLoading} className="w-full py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
              {mfaLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {mfaLoading ? 'Generando QR...' : 'Configurar 2FA'}
            </button>
          </div>
        )}

        {mfaStep === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-300 text-center">Escanea este código QR con tu app autenticadora:</p>
            {mfaQR && (
              <div className="flex justify-center">
                <img src={mfaQR} alt="QR 2FA" className="w-48 h-48 border border-gray-200 dark:border-slate-600 rounded-xl p-2 bg-white" />
              </div>
            )}
            {mfaSecret && (
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Clave manual:</p>
                <p className="font-mono text-sm font-bold text-gray-800 dark:text-slate-100 tracking-wider break-all">{mfaSecret}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1.5">Introduce el código de verificación de 6 dígitos:</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-3 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-center text-2xl font-mono font-bold tracking-widest text-gray-800 dark:text-slate-100 outline-none focus:border-emerald-400"
              />
            </div>
            {mfaError && <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">{mfaError}</div>}
            <button onClick={handle2FAVerify} disabled={mfaLoading || mfaCode.length < 6}
              className="w-full py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
              {mfaLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {mfaLoading ? 'Verificando...' : 'Verificar y activar'}
            </button>
          </div>
        )}

        {mfaStep === 'done' && mfaEnabled && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto">
              <i className="ri-shield-check-fill text-green-500 text-3xl" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-1">2FA activo ✓</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Tu cuenta está protegida con autenticación de dos factores.</p>
            </div>
            <button onClick={handle2FADisable}
              className="w-full py-2.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg font-medium text-sm hover:bg-red-50 dark:hover:bg-red-900/10">
              Desactivar 2FA
            </button>
          </div>
        )}
      </Modal>

      {/* ── Sessions Modal ──────────────────────────────────────────── */}
      <Modal isOpen={showSessionsModal} onClose={() => setShowSessionsModal(false)} title="Historial de sesiones" size="md">
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-slate-400">Dispositivos que han accedido a tu cuenta recientemente.</p>
          {loadingSessions ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className={`p-4 rounded-xl border ${session.current ? 'border-orange-200 dark:border-orange-500/30 bg-orange-50/30 dark:bg-orange-900/10' : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800/50'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${session.current ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-slate-700'}`}>
                      <i className={`text-lg ${session.device.includes('móvil') ? 'ri-smartphone-line' : 'ri-computer-line'} ${session.current ? 'text-orange-600' : 'text-gray-500 dark:text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{session.browser}</p>
                        {session.current && <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-[10px] font-bold rounded">SESIÓN ACTUAL</span>}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{session.os} · {session.device}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        <i className="ri-time-line mr-1" />{session.lastSeen}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="py-8 text-center text-gray-400 dark:text-slate-500">
                  <i className="ri-history-line text-3xl" />
                  <p className="text-sm mt-2">No hay sesiones registradas</p>
                </div>
              )}
            </div>
          )}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
            <button onClick={async () => { await supabase.auth.signOut({ scope: 'global' }); navigate('/login'); }}
              className="w-full py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center justify-center gap-2">
              <i className="ri-logout-circle-r-line" />
              Cerrar sesión en todos los dispositivos
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Logout Confirm ───────────────────────────────────────────── */}
      <Modal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} size="sm" hideCloseButton>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-3">
            <i className="ri-logout-box-r-line text-red-500 text-2xl" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-2">Cerrar sesión</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">¿Estás seguro de que quieres cerrar sesión?</p>
          <div className="flex gap-3">
            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={handleLogout} className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">Sí, cerrar sesión</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
