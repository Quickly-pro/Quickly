import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

// Valores por defecto reales (vacíos) para una empresa que todavía no ha
// rellenado su ficha en Configuración → Empresa. Antes aquí se usaba una
// empresa de ejemplo ("Quickly Distribuciones S.L.") como relleno, que se
// colaba como si fuera un dato real (en la cabecera, el menú, la ficha de
// empresa e incluso en los emails enviados a clientes) hasta que el dueño
// completaba cada campo — y sustituía en silencio cualquier campo que el
// dueño dejara vacío a propósito.
const emptyCompany = {
  name: '',
  legalName: '',
  cif: '',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  email: '',
  website: '',
  logo: '/logo.png',
  brandColor: '#f97316',
  founded: '',
  employees: 0,
  clients: 0,
  monthlyRevenue: 0,
};

export interface CompanyData {
  name: string;
  legalName: string;
  cif: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  logo: string;
  brandColor: string;
  founded: string;
  employees: number;
  clients: number;
  monthlyRevenue: number;
  paymentBizum?: string;
  paymentIban?: string;
  paymentPaypal?: string;
  paymentStripe?: string;
  inviteCode?: string;
}

const STORAGE_KEY = 'quickly_company_data';

function fromDb(row: any): CompanyData {
  return {
    name:           row.name           || emptyCompany.name,
    legalName:      row.legal_name     || emptyCompany.legalName,
    cif:            row.cif            || emptyCompany.cif,
    address:        row.address        || emptyCompany.address,
    city:           row.city           || emptyCompany.city,
    postalCode:     row.postal_code    || emptyCompany.postalCode,
    phone:          row.phone          || emptyCompany.phone,
    email:          row.email          || emptyCompany.email,
    website:        row.website        || emptyCompany.website,
    logo:           row.logo           || emptyCompany.logo,
    brandColor:     row.brand_color    || emptyCompany.brandColor,
    founded:        row.founded        || emptyCompany.founded,
    employees:      row.employees      ?? emptyCompany.employees,
    clients:        row.clients        ?? emptyCompany.clients,
    monthlyRevenue: row.monthly_revenue ?? emptyCompany.monthlyRevenue,
    paymentBizum:   row.payment_bizum  || '',
    paymentIban:    row.payment_iban   || '',
    paymentPaypal:  row.payment_paypal || '',
    paymentStripe:  row.payment_stripe || '',
    inviteCode:     row.invite_code    || '',
  };
}

function toDb(data: Partial<CompanyData>): Record<string, any> {
  const db: Record<string, any> = {};
  if (data.name           !== undefined) db.name            = data.name;
  if (data.legalName      !== undefined) db.legal_name      = data.legalName;
  if (data.cif            !== undefined) db.cif             = data.cif;
  if (data.address        !== undefined) db.address         = data.address;
  if (data.city           !== undefined) db.city            = data.city;
  if (data.postalCode     !== undefined) db.postal_code     = data.postalCode;
  if (data.phone          !== undefined) db.phone           = data.phone;
  if (data.email          !== undefined) db.email           = data.email;
  if (data.website        !== undefined) db.website         = data.website;
  if (data.logo           !== undefined) db.logo            = data.logo;
  if (data.brandColor     !== undefined) db.brand_color     = data.brandColor;
  if (data.founded        !== undefined) db.founded         = data.founded;
  if (data.employees      !== undefined) db.employees       = data.employees;
  if (data.clients        !== undefined) db.clients         = data.clients;
  if (data.monthlyRevenue !== undefined) db.monthly_revenue = data.monthlyRevenue;
  if (data.paymentBizum   !== undefined) db.payment_bizum   = data.paymentBizum;
  if (data.paymentIban    !== undefined) db.payment_iban    = data.paymentIban;
  if (data.paymentPaypal  !== undefined) db.payment_paypal  = data.paymentPaypal;
  if (data.paymentStripe  !== undefined) db.payment_stripe  = data.paymentStripe;
  return db;
}

function loadCache(): CompanyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyCompany, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...emptyCompany };
}

interface CompanyContextValue {
  data: CompanyData;
  update: (partial: Partial<CompanyData>) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
  isOwner: boolean;
  ownerId: string | null;
  refetch: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<CompanyData>(loadCache);
  const [loading, setLoading] = useState(true);

  // Si el usuario se unió a otra empresa con un código, todas las
  // lecturas/escrituras de "empresa" deben apuntar al dueño original,
  // no a su propia fila (que estaría vacía).
  const effectiveOwnerId = user?.company_id || user?.id || null;
  const isOwner = !user?.company_id;

  const fetchFromDb = useCallback(async () => {
    if (!effectiveOwnerId) {
      setLoading(false);
      return;
    }
    try {
      const { data: row, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', effectiveOwnerId)
        .maybeSingle();

      if (!error && row) {
        const mapped = fromDb(row);
        setData(mapped);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      }
    } catch {
      // Si falla Supabase, usa el caché de localStorage
    } finally {
      setLoading(false);
    }
  }, [effectiveOwnerId]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchFromDb();
  }, [user, fetchFromDb]);

  const update = useCallback(async (partial: Partial<CompanyData>): Promise<{ success: boolean; error?: string }> => {
    if (!effectiveOwnerId) {
      return { success: false, error: 'No hay una empresa asociada a tu cuenta todavía' };
    }

    const dbFields = toDb(partial);
    if (Object.keys(dbFields).length === 0) return { success: true };

    const { error } = await supabase
      .from('company_settings')
      .upsert(
        { user_id: effectiveOwnerId, ...dbFields, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error guardando datos de empresa:', error);
      return { success: false, error: error.message || 'No se pudieron guardar los cambios' };
    }

    // Solo se actualiza el estado local (y la caché) UNA VEZ confirmado que
    // Supabase guardó de verdad — antes se actualizaba antes de comprobarlo,
    // por lo que un fallo silencioso hacía parecer que se había guardado.
    setData((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    return { success: true };
  }, [effectiveOwnerId]);

  return (
    <CompanyContext.Provider value={{ data, update, loading, isOwner, ownerId: effectiveOwnerId, refetch: fetchFromDb }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompanyContext must be used inside CompanyProvider');
  return ctx;
}
