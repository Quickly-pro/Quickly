import { useState, useCallback } from 'react';
import { companyInfo } from '@/mocks/company';

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
}

const STORAGE_KEY = 'quickly_company_data';

function loadData(): CompanyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...companyInfo, ...JSON.parse(raw) };
  } catch {
    // ignore parse errors
  }
  return { ...companyInfo };
}

export function useCompany() {
  const [data, setData] = useState<CompanyData>(loadData);

  const update = useCallback((partial: Partial<CompanyData>) => {
    setData((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { data, update };
}