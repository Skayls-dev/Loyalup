import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(path) {
  const raw = fs.readFileSync(path, "utf8");
  const map = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

const env = readEnv('.env.production');
const url = env.get('VITE_SUPABASE_URL');
const anon = env.get('VITE_SUPABASE_ANON_KEY');
if (!url || !anon) throw new Error('Missing Supabase env vars');

const supabase = createClient(url, anon);

const auth = await supabase.auth.signInWithPassword({
  email: 'superadmin@loyalup.test',
  password: 'SuperAdmin123!',
});
if (auth.error) throw auth.error;

async function adminInvoke(body) {
  const { data, error } = await supabase.functions.invoke('admin-console', { method: 'POST', body });
  if (error) throw error;
  if (data?.success === false && data?.error) throw new Error(String(data.error));
  return data;
}

const partnerList = await adminInvoke({ action: 'LIST_PARTNERS' });
const targetPartner = (partnerList.partners ?? []).find((p) => p.code === 'KUVAAGO-PRNC') ?? (partnerList.partners ?? [])[0];
if (!targetPartner?.id) throw new Error('No partner found');

const providersList = await adminInvoke({ action: 'LIST_PROVIDERS_WITH_PARTNERS' });
const linkedProvider = (providersList.providers ?? []).find((p) => p?.partner_link?.partner?.id === targetPartner.id);
if (!linkedProvider?.id) {
  const providerFallback = (providersList.providers ?? [])[0];
  if (!providerFallback?.id) throw new Error('No provider found to link');
  await adminInvoke({
    action: 'LINK_PARTNER_PROVIDER',
    partner_id: targetPartner.id,
    fournisseur_id: providerFallback.id,
    role: 'owner',
  });
}

const keyResult = await adminInvoke({
  action: 'GENERATE_PARTNER_KEY',
  partner_id: targetPartner.id,
  environment: 'sandbox',
  scopes: ['transfers:write', 'transfers:read'],
});

const partnerKey = keyResult.key;
if (!partnerKey) throw new Error('Failed to generate partner key');

const externalUserId = `alice-e2e-${Date.now()}`;
const activateRes = await supabase.functions.invoke('partner-activate', {
  method: 'POST',
  headers: {
    'X-Partner-Key': partnerKey,
  },
  body: {
    external_user_id: externalUserId,
    email: 'alice@test.com',
    display_name: 'Alice',
    create_user_if_missing: true,
  },
});
if (activateRes.error) throw activateRes.error;

const txRef = `alice-e2e-tx-${Date.now()}`;
const transferRes = await supabase.functions.invoke('partner-transfers', {
  method: 'POST',
  headers: {
    'X-Partner-Key': partnerKey,
    'Idempotency-Key': `idem-${Date.now()}`,
  },
  body: {
    external_user_id: externalUserId,
    transaction_ref: txRef,
    points: 120,
    direction: 'credit',
    create_user_if_missing: false,
  },
});
if (transferRes.error) throw transferRes.error;

const transferCheck = await supabase
  .from('partner_point_transfers')
  .select('id, external_user_id, transaction_ref, points_delta, status, resulting_balance, created_at, processed_at')
  .eq('external_user_id', externalUserId)
  .order('created_at', { ascending: false })
  .limit(5);

const walletCheck = await supabase
  .from('partner_points_wallets')
  .select('loyalup_user_id, balance, updated_at')
  .eq('loyalup_user_id', activateRes.data?.activation?.loyalup_user_id ?? '')
  .limit(5);

console.log(JSON.stringify({
  success: true,
  partner_code: targetPartner.code,
  external_user_id: externalUserId,
  activation: activateRes.data,
  transfer: transferRes.data,
  transfer_rows_visible: transferCheck.data ?? [],
  wallet_rows_visible: walletCheck.data ?? [],
  transfer_read_error: transferCheck.error?.message ?? null,
  wallet_read_error: walletCheck.error?.message ?? null,
}, null, 2));
