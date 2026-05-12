export const getStorage = (key: string, defaultValue: any) => {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : defaultValue;
};

export const setStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getCustomLogo = () => localStorage.getItem('custom_logo');

export const setCustomLogo = (logoBase64: string | null) => {
  if (logoBase64) {
    localStorage.setItem('custom_logo', logoBase64);
  } else {
    localStorage.removeItem('custom_logo');
  }
};

export interface AdminSettings {
  exchangeRate: number;
  bankName: string;
  bankAccount: string;
  bankBeneficiary: string;
  bankRNC: string;
  bankCedula: string;
  bankType: string;
  cryptoWallet: string;
  cryptoNetwork: string;
  activeInvestors: number;
  logoUrl?: string;
}

export const defaultSettings: AdminSettings = {
  exchangeRate: 60.50,
  bankName: 'Banco Ademi',
  bankAccount: '1005741045',
  bankBeneficiary: 'Jenifer duran',
  bankRNC: '1-32-44556-1',
  bankCedula: '224-0076405-0',
  bankType: 'Corriente',
  cryptoWallet: '8xxtKBPB...SolanaAddress',
  cryptoNetwork: 'SOLANA (SPL)',
  activeInvestors: 3410,
  logoUrl: ''
};

export const getAdminSettings = (): AdminSettings => {
  const settings = getStorage('admin_settings', defaultSettings);
  return { ...defaultSettings, ...settings };
};

export const setAdminSettings = (settings: AdminSettings) => {
  setStorage('admin_settings', settings);
};

export interface ReferralTx {
  id: string;
  fromUser: string;
  amount: number;
  date: string;
  status: 'PAGADO';
}

export interface Deposit {
  id: string;
  amount: number;
  amountFiat?: number;
  method: string;
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  date: string;
  hash?: string;
  proofImage?: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  status: 'PENDIENTE' | 'COMPLETADO' | 'RECHAZADO';
  date: string;
  type: 'BANCO' | 'USDT';
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  balance: number;
  available: number;
  locked: number;
  referralsEarned: number;
  referralsAvailable?: number;
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  contracts: any[];
  referralHistory: ReferralTx[];
  referredBy?: string | null;
}

if (!localStorage.getItem('users_db')) {
  setStorage('users_db', []);
}

if (!localStorage.getItem('global_stats')) {
  setStorage('global_stats', {
    totalManaged: 17420500,
    totalPaid: 5122800,
    dailyYield: 2.15
  });
}