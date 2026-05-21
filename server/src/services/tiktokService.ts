import axios from 'axios';

const APP_ID = process.env.TIKTOK_APP_ID || '';
const APP_SECRET = process.env.TIKTOK_APP_SECRET || '';
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:5000/api/tiktok/callback';
const BC_ID = process.env.TIKTOK_BC_ID || '';
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

  // 1. BC POST endpoint ilə real advertiser-ləri çək
  let advertiserIds: string[] = [];
  if (BC_ID) {
    try {
      const bcR = await axios.post(`${BASE}/bc/advertiser/get/`,
        { bc_id: BC_ID, page_size: 50 },
        { headers: { 'Access-Token': accessToken } }
      );
      console.log('[TikTok] bc/advertiser/get POST ->', bcR.data.code, bcR.data.message, JSON.stringify(bcR.data.data));
      if (bcR.data.code === 0) {
        advertiserIds = (bcR.data.data?.list || []).map((a: any) => String(a.advertiser_id || a.id));
        console.log('[TikTok] BC advertisers:', advertiserIds);
      }
    } catch (e: any) {
      console.error('[TikTok] bc advertiser error:', e.code, e.message);
    }
  }

  // 2. BC boşdursa oauth2/advertiser/get-ə bax
  if (advertiserIds.length === 0) {
    try {
      const advR = await axios.get(`${BASE}/oauth2/advertiser/get/`, {
        headers: { 'Access-Token': accessToken },
        params: { app_id: APP_ID, secret: APP_SECRET },
      });
      const raw = (advR.data.data?.list || []).map((a: any) => String(a.advertiser_id));
      // BC_ID-ni saxla — report üçün istifadə oluna bilər
      advertiserIds = raw.length > 0 ? raw : (BC_ID ? [BC_ID] : []);
      console.log('[TikTok] oauth2/advertiser/get ->', advR.data.code, '→', advertiserIds);
    } catch (e: any) {
      console.error('[TikTok] oauth2/advertiser/get error:', e.message);
      if (BC_ID) advertiserIds = [BC_ID];
    }
  }

  return { accessToken, advertiserIds };
}

export async function getAdvertiserInfo(accessToken: string, advertiserId: string): Promise<{ id: string; name: string }> {
  try {
    const r = await axios.get(`${BASE}/advertiser/info/`, {
      headers: { 'Access-Token': accessToken },
      params: {
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
  const r = await axios.get(`${BASE}/report/integrated/get/`, {
    headers: { 'Access-Token': accessToken },
    params: {
      advertiser_id: advertiserId,
      report_type: 'BASIC',
      dimensions: JSON.stringify(['campaign_id']),
      data_level: 'AUCTION_CAMPAIGN',
      start_date: startDate,
      end_date: endDate,
      metrics: JSON.stringify(['campaign_name', 'spend', 'impressions', 'clicks', 'cpc', 'cpm']),
      page_size: 200,
    },
    timeout: 30000,
  });

  console.log('[TikTok] report response:', r.data.code, r.data.message, 'items:', r.data.data?.list?.length ?? 0);
  if (r.data.code !== 0) {
    throw new Error(`TikTok API: ${r.data.code} — ${r.data.message}`);
  }
  return (r.data.data?.list || []).map((item: any) => ({
    id: item.dimensions?.campaign_id || '',
    name: item.metrics?.campaign_name || '',
    status: 'ACTIVE',
    spend: parseFloat(item.metrics?.spend || '0'),
    impressions: parseInt(item.metrics?.impressions || '0'),
    clicks: parseInt(item.metrics?.clicks || '0'),
    cpc: parseFloat(item.metrics?.cpc || '0'),
    cpm: parseFloat(item.metrics?.cpm || '0'),
    advertiserId,
    advertiserName,
  }));
}
