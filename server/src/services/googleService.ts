import { google } from 'googleapis';
import axios from 'axios';
import { decrypt } from '../utils/encryption';

const OAUTH2_CLIENT = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/callback'
);

const SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/userinfo.email',
];
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
const MANAGER_ID = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID || '';
const ADS_API_VERSION = 'v20';
const ADS_API_BASE = `https://googleads.googleapis.com/${ADS_API_VERSION}`;

export function getAuthUrl(state: string): string {
  return OAUTH2_CLIENT.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiry: Date;
  email: string;
}> {
  const { tokens } = await OAUTH2_CLIENT.getToken(code);
  OAUTH2_CLIENT.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: OAUTH2_CLIENT });
  const userInfo = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token || '',
    refreshToken: tokens.refresh_token || '',
    expiry: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
    email: userInfo.data.email || '',
  };
}

export async function getAccessToken(refreshTokenEncrypted: string): Promise<string> {
  const refreshToken = decrypt(refreshTokenEncrypted);
  OAUTH2_CLIENT.setCredentials({ refresh_token: refreshToken });
  const { token } = await OAUTH2_CLIENT.getAccessToken();
  return token || '';
}


async function adsApiSearch(query: string, accessToken: string, customerId: string, loginCustomerId?: string): Promise<any[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  };
  const managerId = loginCustomerId || MANAGER_ID;
  if (managerId) headers['login-customer-id'] = managerId.replace(/-/g, '');
  const response = await axios.post(
    `${ADS_API_BASE}/customers/${customerId}/googleAds:search`,
    { query },
    { headers, timeout: 30000 }
  );
  return response.data.results || [];
}

export async function getAccessibleCustomers(accessToken: string): Promise<Array<{ id: string; name: string; managerId?: string }>> {
  const allCustomers = new Map<string, { name: string; managerId?: string }>();
  try {
    const response = await axios.get(`${ADS_API_BASE}/customers:listAccessibleCustomers`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN },
      timeout: 15000,
    });
    const resourceNames: string[] = response.data.resourceNames || [];

    await Promise.all(resourceNames.map(async (rn) => {
      const id = rn.split('/')[1];
      try {
        const info = await adsApiSearch(`SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1`, accessToken, id);
        const row = info[0]?.customer;
        const name = row?.descriptiveName || `Account ${id}`;
        const isManager = row?.manager === true;
        if (!allCustomers.has(id)) allCustomers.set(id, { name, managerId: undefined });

        if (isManager) {
          try {
            const subRows = await adsApiSearch(
              `SELECT customer_client.id, customer_client.descriptive_name, customer_client.level FROM customer_client WHERE customer_client.level = 1`,
              accessToken, id
            );
            for (const sub of subRows) {
              const subId = sub.customerClient?.id?.toString();
              const subName = sub.customerClient?.descriptiveName || `Account ${subId}`;
              // Sub-hesab üçün manager ID-ni saxla (login-customer-id üçün lazımdır)
              if (subId && !allCustomers.has(subId)) allCustomers.set(subId, { name: subName, managerId: id });
            }
          } catch { }
        }
      } catch {
        if (!allCustomers.has(id)) allCustomers.set(id, { name: `Account ${id}`, managerId: undefined });
      }
    }));
  } catch (e: any) {
    console.error('[Google] listAccessibleCustomers error:', e.response?.data?.error?.message || e.message);
  }
  return [...allCustomers.entries()].map(([id, info]) => ({ id, name: info.name, managerId: info.managerId }));
}

// Customer-in bütün label adlarını çək (id → name)
export async function getCustomerLabels(customerId: string, accessToken: string, managerId?: string): Promise<Record<string, string>> {
  const cleanId = customerId.replace(/-/g, '');
  try {
    const results = await adsApiSearch(`SELECT label.id, label.name FROM label`, accessToken, cleanId, managerId);
    const map: Record<string, string> = {};
    for (const r of results) {
      const id = r.label?.id?.toString();
      const name = r.label?.name;
      if (id && name) map[id] = name;
    }
    return map;
  } catch { return {}; }
}

// Account səviyyəsindəki top-3 keyword (bütün search kampaniyaları üzrə)
export async function getAccountTopKeywords(customerId: string, accessToken: string, startDate: string, endDate: string, managerId?: string): Promise<GoogleKeyword[]> {
  const cleanId = customerId.replace(/-/g, '');
  const query = `
    SELECT
      ad_group_criterion.keyword.text,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.average_cpc
    FROM keyword_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND campaign.status != 'REMOVED'
      AND ad_group_criterion.status != 'REMOVED'
      AND metrics.cost_micros > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;
  try {
    const results = await adsApiSearch(query, accessToken, cleanId, managerId);
    // Eyni keyword mətnini birləşdir
    const kwMap = new Map<string, GoogleKeyword>();
    for (const r of results) {
      const text = r.adGroupCriterion?.keyword?.text || '';
      if (!text) continue;
      const cost = Number(r.metrics?.costMicros || 0);
      if (kwMap.has(text)) {
        const kw = kwMap.get(text)!;
        kw.costMicros += cost;
        kw.clicks += Number(r.metrics?.clicks || 0);
        kw.impressions += Number(r.metrics?.impressions || 0);
      } else {
        kwMap.set(text, {
          text,
          costMicros: cost,
          impressions: Number(r.metrics?.impressions || 0),
          clicks: Number(r.metrics?.clicks || 0),
          avgCpcMicros: Number(r.metrics?.averageCpc || 0),
        });
      }
    }
    return [...kwMap.values()].sort((a, b) => b.costMicros - a.costMicros).slice(0, 3);
  } catch { return []; }
}

export interface GoogleCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  labels: string[];        // resource names
  labelNames: string[];    // real label text
  costMicros: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpcMicros: number;
  conversions: number;
  topKeywords?: GoogleKeyword[];
}

export interface GoogleKeyword {
  text: string;
  costMicros: number;
  impressions: number;
  clicks: number;
  avgCpcMicros: number;
}

export async function getCampaignReport(
  customerId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  managerId?: string
): Promise<GoogleCampaign[]> {
  const cleanId = customerId.replace(/-/g, '');
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.labels,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `;

  try {
    const labelMap = await getCustomerLabels(cleanId, accessToken, managerId);
    const results = await adsApiSearch(query, accessToken, cleanId, managerId);
    const campaigns: GoogleCampaign[] = results.map((r: any) => {
      const labelResourceNames: string[] = r.campaign?.labels || [];
      const labelNames = labelResourceNames
        .map((rn: string) => { const id = rn.split('/').pop(); return id ? labelMap[id] : null; })
        .filter(Boolean) as string[];
      return {
        id: r.campaign?.id || '',
        name: r.campaign?.name || '',
        status: r.campaign?.status || '',
        type: r.campaign?.advertisingChannelType || 'UNKNOWN',
        labels: labelResourceNames,
        labelNames,
        costMicros: Number(r.metrics?.costMicros || 0),
        impressions: Number(r.metrics?.impressions || 0),
        clicks: Number(r.metrics?.clicks || 0),
        ctr: Number(r.metrics?.ctr || 0),
        avgCpcMicros: Number(r.metrics?.averageCpc || 0),
        conversions: Number(r.metrics?.conversions || 0),
      };
    });

    // fetch top 3 keywords for SEARCH campaigns
    const searchCampaigns = campaigns.filter((c) => c.type === 'SEARCH');
    if (searchCampaigns.length > 0) {
      const kwResults = await getTopKeywordsByCampaign(cleanId, accessToken, startDate, endDate);
      for (const c of searchCampaigns) {
        c.topKeywords = kwResults[c.id] || [];
      }
    }
    return campaigns;
  } catch (e: any) {
    if (e.response?.status === 429) throw e; // Kvota bitib — gizlətmə
    return [];
  }
}

async function getTopKeywordsByCampaign(
  customerId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Record<string, GoogleKeyword[]>> {
  const query = `
    SELECT
      campaign.id,
      ad_group_criterion.keyword.text,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.average_cpc
    FROM keyword_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND campaign.status != 'REMOVED'
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `;

  try {
    const results = await adsApiSearch(query, accessToken, customerId);
    const map: Record<string, GoogleKeyword[]> = {};
    for (const r of results) {
      const cid = r.campaign?.id || '';
      if (!map[cid]) map[cid] = [];
      if (map[cid].length < 3) {
        map[cid].push({
          text: r.adGroupCriterion?.keyword?.text || '',
          costMicros: Number(r.metrics?.costMicros || 0),
          impressions: Number(r.metrics?.impressions || 0),
          clicks: Number(r.metrics?.clicks || 0),
          avgCpcMicros: Number(r.metrics?.averageCpc || 0),
        });
      }
    }
    return map;
  } catch {
    return {};
  }
}

export interface GoogleAdGroup {
  id: string;
  name: string;
  costMicros: number;
}

export async function getAdGroupSpend(
  campaignId: string,
  customerId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  managerId?: string
): Promise<GoogleAdGroup[]> {
  const cleanId = customerId.replace(/-/g, '');
  const query = `
    SELECT ad_group.id, ad_group.name, metrics.cost_micros
    FROM ad_group
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.id = ${campaignId}
      AND ad_group.status != 'REMOVED'
      AND metrics.cost_micros > 0
    ORDER BY metrics.cost_micros DESC
  `;
  try {
    const results = await adsApiSearch(query, accessToken, cleanId, managerId);
    return results.map((r: any) => ({
      id: r.adGroup?.id || '',
      name: r.adGroup?.name || '',
      costMicros: Number(r.metrics?.costMicros || 0),
    }));
  } catch { return []; }
}

export async function getAdLevelSpend(
  adGroupId: string,
  customerId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  managerId?: string
): Promise<Array<{ name: string; costMicros: number }>> {
  const cleanId = customerId.replace(/-/g, '');
  const query = `
    SELECT ad_group_ad.ad.id,
           ad_group_ad.ad.responsive_search_ad.headlines,
           ad_group_ad.ad.responsive_display_ad.headlines,
           ad_group_ad.ad.name,
           metrics.cost_micros
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND ad_group.id = ${adGroupId}
      AND ad_group_ad.status != 'REMOVED'
      AND metrics.cost_micros > 0
    ORDER BY metrics.cost_micros DESC
  `;
  try {
    const results = await adsApiSearch(query, accessToken, cleanId, managerId);
    return results.map((r: any) => {
      const ad = r.adGroupAd?.ad || {};
      // Ad adını: responsive search ad headlines, display headlines, və ya ad.name-dən al
      const rsaHeadlines: string[] = (ad.responsiveSearchAd?.headlines || []).map((h: any) => h.text || '');
      const rdaHeadlines: string[] = (ad.responsiveDisplayAd?.headlines || []).map((h: any) => h.text || '');
      const adName: string = ad.name || '';
      const name = [...rsaHeadlines, ...rdaHeadlines, adName].filter(Boolean).join(' | ');
      return { name, costMicros: Number(r.metrics?.costMicros || 0) };
    });
  } catch { return []; }
}

export async function getPreviousPeriodCampaigns(
  customerId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GoogleCampaign[]> {
  return getCampaignReport(customerId, accessToken, startDate, endDate);
}

export function microsToCurrency(micros: number): number {
  return micros / 1_000_000;
}
