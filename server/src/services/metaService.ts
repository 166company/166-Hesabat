import axios from 'axios';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
}

export interface MetaInsights {
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  cpm: string;
  cpc: string;
  ctr: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start?: string;
  date_stop?: string;
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

export interface MetaBusinessSuiteInfo {
  id: string;
  name: string;
}

async function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const response = await axios.get(`${GRAPH_API_BASE}${path}`, {
    params: { ...params, access_token: token },
    timeout: 30000,
  });
  return response.data as T;
}

export async function validateToken(token: string): Promise<{ valid: boolean; userId?: string; name?: string }> {
  try {
    const appToken = process.env.META_APP_ID && process.env.META_APP_SECRET
      ? `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
      : token;

    const data = await graphGet<{ data: { is_valid: boolean; user_id?: string } }>(
      '/debug_token',
      { input_token: token, access_token: appToken },
      token
    );
    if (data.data.is_valid) {
      const me = await graphGet<{ id: string; name: string }>('/me', { fields: 'id,name' }, token);
      return { valid: true, userId: me.id, name: me.name };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

export async function getBusinessSuites(token: string): Promise<MetaBusinessSuiteInfo[]> {
  const data = await graphGet<{ data: MetaBusinessSuiteInfo[] }>(
    '/me/businesses',
    { fields: 'id,name', limit: '50' },
    token
  );
  return data.data || [];
}

export async function getAdAccountsForBusiness(businessId: string, token: string): Promise<MetaAdAccount[]> {
  const data = await graphGet<{ data: MetaAdAccount[] }>(
    `/${businessId}/owned_ad_accounts`,
    { fields: 'id,name,currency,account_status', limit: '100' },
    token
  );
  return data.data || [];
}

export async function getPersonalAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const data = await graphGet<{ data: MetaAdAccount[] }>(
    '/me/adaccounts',
    { fields: 'id,name,currency,account_status', limit: '100' },
    token
  );
  return data.data || [];
}

export async function getAccountInsights(
  accountId: string,
  token: string,
  startDate: string,
  endDate: string
): Promise<MetaInsights> {
  const accId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  try {
    const data = await graphGet<{ data: MetaInsights[] }>(
      `/${accId}/insights`,
      {
        fields: 'spend,impressions,clicks,reach,cpm,cpc,ctr,actions',
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        level: 'account',
        limit: '1',
      },
      token
    );
    return data.data?.[0] || zeroed();
  } catch {
    return zeroed();
  }
}

export async function getCampaigns(
  accountId: string,
  token: string,
  startDate: string,
  endDate: string
): Promise<MetaCampaign[]> {
  const accId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  try {
    // Bütün kampaniyaları VƏ onların insights-ini TEK sorğuda çək (batch)
    const data = await graphGet<{ data: Array<{ campaign_id: string; campaign_name: string; spend: string; impressions: string; clicks: string; reach: string; cpm: string; cpc: string; ctr: string }> }>(
      `/${accId}/insights`,
      {
        level: 'campaign',
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,cpm,cpc,ctr',
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        limit: '200',
      },
      token
    );
    const rows = data.data || [];
    return rows
      .filter(r => parseFloat(r.spend || '0') > 0)
      .map(r => ({
        id: r.campaign_id,
        name: r.campaign_name,
        status: 'ACTIVE',
        objective: '',
        insights: {
          spend: r.spend,
          impressions: r.impressions,
          clicks: r.clicks,
          reach: r.reach,
          cpm: r.cpm,
          cpc: r.cpc,
          ctr: r.ctr,
        },
      }));
  } catch {
    return [];
  }
}

export async function getFullAccountReport(
  accountId: string,
  account: MetaAdAccount,
  token: string,
  startDate: string,
  endDate: string,
  prevStartDate?: string,
  prevEndDate?: string
): Promise<MetaAccountReport> {
  const [insights, campaigns, previousInsights] = await Promise.all([
    getAccountInsights(accountId, token, startDate, endDate),
    getCampaigns(accountId, token, startDate, endDate),
    prevStartDate && prevEndDate
      ? getAccountInsights(accountId, token, prevStartDate, prevEndDate)
      : Promise.resolve(undefined),
  ]);

  return { account, insights, campaigns, previousInsights };
}

function zeroed(): MetaInsights {
  return { spend: '0', impressions: '0', clicks: '0', reach: '0', cpm: '0', cpc: '0', ctr: '0' };
}
