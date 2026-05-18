export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'pending' | 'approved' | 'denied';
  chatAccess: 'none' | 'pending' | 'approved' | 'denied';
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

// Meta Ads Types
export interface MetaInsights {
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  cpm: string;
  cpc: string;
  ctr: string;
  actions?: Array<{ action_type: string; value: string }>;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  insights?: MetaInsights;
}

export interface MetaAccountReport {
  account: MetaAdAccount;
  insights: MetaInsights;
  campaigns: MetaCampaign[];
  previousInsights?: MetaInsights;
}

export interface MetaBusinessSuite {
  id: string;
  businessSuiteId: string;
  businessSuiteName: string;
  isValid: boolean;
  lastValidated: string;
}

export interface MetaReport {
  businessSuiteId: string;
  businessSuiteName: string;
  startDate: string;
  endDate: string;
  reports: MetaAccountReport[];
}

// Google Ads Types
export interface GoogleKeyword {
  text: string;
  costMicros: number;
  cost: number;
  impressions: number;
  clicks: number;
  avgCpcMicros: number;
  avgCpc: number;
}

export interface GoogleCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  labels: string[];
  costMicros: number;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpcMicros: number;
  avgCpc: number;
  conversions: number;
  topKeywords?: GoogleKeyword[];
}

export interface GoogleReport {
  customerId: string;
  startDate: string;
  endDate: string;
  campaigns: GoogleCampaign[];
  previousCampaigns: GoogleCampaign[];
  accountTopKeywords?: GoogleKeyword[];
}

export interface GoogleCustomer {
  id: string;
  name: string;
}

export interface GoogleStatus {
  connected: boolean;
  verified: boolean;
  email?: string;
  customers?: GoogleCustomer[];
}

// Chat
export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
}

export type Language = 'az' | 'ru' | 'en';
