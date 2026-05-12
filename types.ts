export enum AppRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export type Screen = 'DASHBOARD' | 'CLIENTS' | 'WITHDRAWALS' | 'SETTINGS' | 'PLANS' | 'REFERRALS' | 'PROFILE' | 'HOW_IT_WORKS' | 'HISTORY';

export interface Contract {
  id: string;
  planId: string;
  name: string;
  amount: number;
  amountFiat?: number;
  dailyRate: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'ACTIVE' | 'COMPLETED';
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

export interface ReferralTx {
  id: string;
  fromUser: string;
  amount: number;
  date: string;
  status: 'PAGADO';
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
  contracts: Contract[];
  referralHistory: ReferralTx[];
  referredBy?: string | null;
}
