import 'dotenv/config';

const BASE_URL = 'https://ez-class-pay.vercel.app';

const LIFF_MAP = [
  { id: process.env.LIFF_ID_CREATE_ROOM,    path: '/create-room' },
  { id: process.env.LIFF_ID_PAY_BILL,       path: '/pay-bill' },
  { id: process.env.LIFF_ID_APPROVE,        path: '/approve-payments' },
  { id: process.env.LIFF_ID_EXPENSE,        path: '/expense' },
  { id: process.env.LIFF_ID_HISTORY,        path: '/history' },
  { id: process.env.LIFF_ID_MEMBER_HISTORY, path: '/member-history' },
  { id: process.env.LIFF_ID_VERIFY_SLIP,    path: '/verify-slip' },
  { id: process.env.LIFF_ID_DASHBOARD,      path: '/dashboard' },
];

async function getAccessToken() {
  const channelId = process.env.LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LOGIN_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    console.error('❌ ต้องใส่ LOGIN_CHANNEL_ID และ LOGIN_CHANNEL_SECRET ใน .env');
    process.exit(1);
  }

  const resp = await fetch('https://api.line.me/v2/oauth/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });

  if (!resp.ok) {
    console.error('❌ ไม่สามารถสร้าง access token:', resp.status, await resp.text());
    process.exit(1);
  }

  const data = await resp.json();
  return data.access_token;
}

async function main() {
  console.log('🔑 กำลังสร้าง access token...\n');
  const token = await getAccessToken();
  console.log('✅ ได้ access token แล้ว!\n');

  console.log('🔍 ดึงรายการ LIFF apps...\n');
  const listResp = await fetch('https://api.line.me/liff/v1/apps', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listResp.ok) {
    const errText = await listResp.text();
    console.error(`❌ ${listResp.status}: ${errText}`);
    process.exit(1);
  }

  const { apps } = await listResp.json();
  console.log(`พบ LIFF app ทั้งหมด ${apps.length} ตัว\n`);

  const registered = new Map(apps.map(a => [a.liffId, a]));

  for (const { id, path } of LIFF_MAP) {
    if (!id) {
      console.log(`⚠️  ข้าม — ไม่มี env var สำหรับ ${path}`);
      continue;
    }

    const expectedUrl = `${BASE_URL}${path}`;
    const app = registered.get(id);

    if (!app) {
      console.log(`❌ LIFF ${id} (${path}) — ไม่พบใน LINE Console`);
      continue;
    }

    const currentUrl = app.view?.url || '';
    if (currentUrl === expectedUrl) {
      console.log(`✅ ${path} — ถูกต้องแล้ว (${expectedUrl})`);
      continue;
    }

    console.log(`🔄 ${path}`);
    console.log(`   ปัจจุบัน: ${currentUrl}`);
    console.log(`   กำลังอัปเดต: ${expectedUrl}`);

    const updateResp = await fetch(`https://api.line.me/liff/v1/apps/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        view: { url: expectedUrl, type: app.view?.type || 'full' },
      }),
    });

    if (updateResp.ok) {
      console.log('   ✅ อัปเดตสำเร็จ!\n');
    } else {
      console.error(`   ❌ ล้มเหลว: ${updateResp.status} ${await updateResp.text()}\n`);
    }
  }

  console.log('🎉 เสร็จสิ้น! รีเฟรช LINE แล้วลองกด Rich Menu อีกครั้ง');
}

main().catch(console.error);
