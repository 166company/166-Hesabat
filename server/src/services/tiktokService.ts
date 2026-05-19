import axios from 'axios';

const APP_ID = process.env.TIKTOK_APP_ID || '';
const APP_SECRET = process.env.TIKTOK_APP_SECRET || '';
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:5000/api/tiktok/callback';
const BASE = 'https://business-api.tiktok.com/open_api/v1.3';

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    app_id: APP_ID,
    state,
    redirect_uri: REDIRECT_URI,
    rid: 'ads_audit',
  });
  return `https://business-api.tiktok.com/portal/auth?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; advertiserIds: string[] }> {
  const r = await axios.post(`${BASE}/oauth2/access_token/`, {
    app_id: APP_ID,
    secret: APP_SECRET,
    auth_code: code,
  });
  if (r.data.code !== 0) throw new Error(r.data.message);
  const accessToken: string = r.data.data.access_token;

  // Advertiser-ləri al
  const advR = await axios.get(`${BASE}/oauth2/advertiser/get/`, {
    params: { access_token: accessToken, app_id: APP_ID, secret: APP_SECRET },
  });
  const advertiserIds: string[] = (advR.data.data?.list || []).map((a: any) => a.advertiser_id);
  return { accessToken, advertiserIds };
}

export async function getAdvertiserInfo(accessToken: string, advertiserId: string): Promise<{ id: string; name: string }> {
  try {
    const r = await axios.get(`${BASE}/advertiser/info/`, {
      params: {
        access_token: accessToken,
        advertiser_ids: JSON.stringify([advertiserId]),
        fields: JSON.stringify(['advertiser_id', 'name']),
      },
    });
    const info = r.data.data?.list?.[0];
    return { id: advertiserId, name: info?.name || `Account ${advertiserId}` };
  } catch { return { id: advertiserId, name: `Account ${advertiserId}` }; }
}

export interface TikTokCampaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  advertiserId: string;
  advertiserName: string;
}

export async function getCampaignReport(
  accessToken: string,
  advertiserId: string,
  startDate: string,
  endDate: string,
  advertiserName = ''
): Promise<TikTokCampaign[]> {
  try {
    const r = await axios.post(`${BASE}/report/integrated/get/`, {
      advertiser_id: advertiserId,
      report_type: 'BASIC',
      dimensions: ['campaign_id'],
      data_level: 'AUCTION_CAMPAIGN',
      start_date: startDate,
      end_date: endDate,
      metrics: ['campaign_name', 'spend', 'impressions', 'clicks', 'cpc', 'cpm', 'status_string'],
      page_size: 200,
    }, {
      headers: { 'Access-Token': accessToken },
      timeout: 30000,
    });

    if (r.data.code !== 0) return [];
    return (r.data.data?.list || []).map((item: any) => ({
      id: item.dimensions?.campaign_id || '',
      name: item.metrics?.campaign_name || '',
      status: item.metrics?.status_string || '',
      spend: parseFloat(item.metrics?.spend || '0'),
      impressions: parseInt(item.metrics?.impressions || '0'),
      clicks: parseInt(item.metrics?.clicks || '0'),
      cpc: parseFloat(item.metrics?.cpc || '0'),
      cpm: parseFloat(item.metrics?.cpm || '0'),
      advertiserId,
      advertiserName,
    })).filter((c: TikTokCampaign) => c.spend > 0);
  } catch { return []; }
}
