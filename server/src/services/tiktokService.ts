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

  // 1. OAuth advertiser endpoint-i sına
  let advertiserIds: string[] = [];
  try {
    const advR = await axios.get(`${BASE}/oauth2/advertiser/get/`, {
      params: { access_token: accessToken, app_id: APP_ID, secret: APP_SECRET },
    });
    advertiserIds = (advR.data.data?.list || []).map((a: any) => String(a.advertiser_id));
    console.log('[TikTok] oauth2/advertiser/get ->', advR.data.code, advertiserIds.length);
  } catch (e: any) {
    console.error('[TikTok] oauth2/advertiser/get error:', e.message);
  }

  // 2. Boşdursa Business Center endpoint-ini sına
  if (advertiserIds.length === 0) {
    try {
      const userR = await axios.get(`${BASE}/user/info/`, {
        params: { access_token: accessToken, fields: JSON.stringify(['display_name', 'bc_id']) },
      });
      console.log('[TikTok] user/info ->', JSON.stringify(userR.data.data));
      const bcId: string | undefined = userR.data.data?.bc_id;
      if (bcId) {
        const bcR = await axios.get(`${BASE}/bc/advertiser/get/`, {
          params: { access_token: accessToken, bc_id: bcId, page_size: 50 },
        });
        console.log('[TikTok] bc/advertiser/get ->', bcR.data.code, JSON.stringify(bcR.data.data?.list?.slice(0, 3)));
        advertiserIds = (bcR.data.data?.list || []).map((a: any) => String(a.advertiser_id));
      }
    } catch (e: any) {
      console.error('[TikTok] bc advertiser error:', e.message);
    }
  }

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
