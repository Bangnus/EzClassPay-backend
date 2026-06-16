import 'dotenv/config';

const BASE_URL = 'https://ez-class-pay.vercel.app';
const ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

// LIFF_ID → Expected endpoint path mapping
const EXPECTED = {
  [process.env.LIFF_ID_PAY_BILL]: '/pay-bill',
  [process.env.LIFF_ID_APPROVE]: '/approve-payments',
  [process.env.LIFF_ID_EXPENSE]: '/expense',
  [process.env.LIFF_ID_HISTORY]: '/history',
  [process.env.LIFF_ID_MEMBER_HISTORY]: '/member-history',
  [process.env.LIFF_ID_VERIFY_SLIP]: '/verify-slip',
  [process.env.LIFF_ID_DASHBOARD]: '/dashboard',
};

const ALL_LIFF_IDS = Object.keys(EXPECTED);

async function main() {
  console.log('🔍 Fetching all LIFF apps from LINE...\n');

  const resp = await fetch('https://api.line.me/liff/v1/apps', {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });

  if (!resp.ok) {
    console.error('❌ Failed to fetch LIFF apps:', resp.status, await resp.text());
    process.exit(1);
  }

  const data = await resp.json();
  const apps = data.apps || [];
  console.log(`Found ${apps.length} LIFF app(s) registered in LINE.\n`);

  let needsUpdate = false;

  for (const app of apps) {
    const liffId = app.liffId;
    const currentUrl = app.view?.url || '(none)';
    const varName = Object.entries(process.env).find(([, v]) => v === liffId)?.[0] || '(unknown var)';
    const expectedPath = EXPECTED[liffId];
    const expectedUrl = expectedPath ? `${BASE_URL}${expectedPath}` : null;

    const status = currentUrl === expectedUrl ? '✅' : '❌';
    console.log(`${status} LIFF: ${liffId}  (${varName})`);
    console.log(`   Current:  ${currentUrl}`);
    console.log(`   Expected: ${expectedUrl || '(no mapping)'}`);
    console.log();

    if (expectedUrl && currentUrl !== expectedUrl) {
      needsUpdate = true;
      console.log(`   >>> Updating to: ${expectedUrl}`);
      const updateResp = await fetch(`https://api.line.me/liff/v1/apps/${liffId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ view: { url: expectedUrl, type: app.view?.type || 'full' } }),
      });
      if (updateResp.ok) {
        console.log('   ✅ Update success!');
      } else {
        console.error(`   ❌ Update failed: ${updateResp.status} ${await updateResp.text()}`);
      }
      console.log();
    }
  }

  // Check for missing LIFF apps
  const registeredIds = apps.map(a => a.liffId);
  for (const liffId of ALL_LIFF_IDS) {
    if (!registeredIds.includes(liffId)) {
      const varName = Object.entries(process.env).find(([, v]) => v === liffId)?.[0] || '(unknown var)';
      console.log(`⚠️  LIFF app ${liffId} (${varName}) is NOT registered in LINE console!`);
      console.log(`   Create it manually with endpoint: ${BASE_URL}${EXPECTED[liffId]}`);
      console.log();
    }
  }

  if (!needsUpdate) {
    console.log('🎉 All LIFF apps already have the correct endpoint URLs!');
  } else {
    console.log('✅ Done updating LIFF endpoint URLs.');
  }
}

main().catch(console.error);
