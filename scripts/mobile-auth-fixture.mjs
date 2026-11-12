import { chromium, webkit } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/** Isolated UI tests: Supabase HTTP and WebSocket traffic never reaches a live project. */
export async function mobileAuthFixture({ authenticated = false, provider = 'email', verification = false, profileUnavailable = false, browserName = 'chromium' } = {}) {
  const origin = process.env.MOBILE_TEST_URL || 'http://localhost:8087';
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Mobile auth tests require a local preview');
  const env = await readFile('.env', 'utf8').catch(() => '');
  const api = process.env.EXPO_PUBLIC_SUPABASE_URL || env.match(/^EXPO_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
  if (!api) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL for the configured local preview');
  const ref = new URL(api).hostname.split('.')[0];
  const me = '11111111-1111-4111-8111-111111111111';
  const seller = '22222222-2222-4222-8222-222222222222';
  const listingId = '33333333-3333-4333-8333-333333333333';
  const conversationId = '44444444-4444-4444-8444-444444444444';
  const now = new Date().toISOString();
  const profile = id => ({ id, full_name: 'Örnek Kullanıcı', phone: '', role: 'user', status: 'active', avatar_url: null, verified_phone: false, verified_identity: false, rating: 0 });
  const seed = JSON.parse(await readFile('lib/listing-seed.json', 'utf8'));
  const listing = { ...seed[0], id: listingId, owner_id: seller, title: 'BMW 320i M Sport', image_url: `${origin}/demo/001-bmw-3-20i-premium-line.jpg`, price: 2350000, commission_type: 'fixed', commission_value: 5000, partnership_mode: 'approval', stock_count: 1, status: 'active' };
  const user = { id: me, aud: 'authenticated', role: 'authenticated', email: 'preview@example.invalid', email_confirmed_at: now, created_at: now, app_metadata: { provider }, user_metadata: { full_name: 'Örnek Kullanıcı' } };
  const exp = Math.floor(Date.now() / 1000) + 7200;
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: me, role: 'authenticated', aud: 'authenticated', exp })).toString('base64url'), 'local-test-only'].join('.');
  const session = { access_token: token, refresh_token: 'local-test', token_type: 'bearer', expires_in: 7200, expires_at: exp, user };
  if (!['chromium', 'webkit'].includes(browserName)) throw new Error('Unsupported test browser');
  const browser = await (browserName === 'webkit' ? webkit : chromium).launch();
  // A service worker can serve cached responses ahead of route mocks (notably in
  // WebKit). Keep these isolated tests entirely under the mocked network layer.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  page.setDefaultTimeout(20000);
  const writes = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(`**${new URL(api).hostname}**`, ws => ws.close());
  await page.route(`${api}/**`, async route => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').at(-1);
    // Match the API's CORS contract in WebKit too. These responses stay local;
    // missing CORS headers otherwise turn successful mocks into fetch errors.
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    let result = [];
    if (url.pathname.includes('/auth/v1/signup') && verification) {
      // Never log or persist the submitted password.
      writes.push({ table: 'signup' }); result = { user: { ...user, identities: [{ provider: 'email' }] }, session: null };
    } else if (url.pathname.includes('/auth/v1/verify')) { writes.push({ table: 'verify' }); result = session; }
    else if (url.pathname.includes('/auth/v1/user')) result = user;
    else if (url.pathname.includes('/auth/v1/token')) result = session;
    else if (table === 'get_my_profile') {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (profileUnavailable) { await route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ message: 'Local test: profile temporarily unavailable' }) }); return; }
      result = [profile(me)];
    }
    else if (table === 'profiles') { result=[profile(me),profile(seller)]; const id=url.searchParams.get('id'); if(id?.startsWith('eq.'))result=result.filter(p=>p.id===id.slice(3)); if(url.searchParams.has('username'))result=[]; }
    else if (table === 'listing_public_cards' || table === 'search_listings') result = [listing];
    else if (request.method() !== 'GET' && ['legal_consents', 'messages', 'partner_join', 'listings', 'reviews', 'ensure_my_profile'].includes(table)) { writes.push({ table, body: request.postDataJSON() }); }
    const single = request.headers().accept?.includes('vnd.pgrst.object');
    await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(single && Array.isArray(result) ? result[0] || null : result) });
  });
  if (authenticated) await page.addInitScript(({ ref, session }) => {
    if (!localStorage.getItem('test-initialized')) {
      localStorage.setItem('test-initialized', '1');
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    }
  }, { ref, session });
  async function go(path) {
    await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await settled();
    // Finish the mocked store bootstrap before the next full navigation. WebKit
    // reports interrupted cross-origin fetches as access-control page errors.
    await page.waitForLoadState('networkidle');
  }
  async function settled() {
    await page.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    await page.getByLabel('Oturum kontrol ediliyor', { exact: true }).waitFor({ state: 'hidden' });
  }
  async function shot(options) {
    // Wait for finite sheet/navigation transitions so screenshots do not capture a closing scrim.
    await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    await page.evaluate(() => {
      let badge = document.getElementById('test-data-label');
      if (!badge) { badge = document.createElement('div'); badge.id = 'test-data-label'; document.body.append(badge); }
      badge.textContent = 'YEREL TEST · ÖRNEK VERİ';
      Object.assign(badge.style, { position: 'fixed', top: '0', right: '0', zIndex: '999999', background: '#fff3cf', color: '#705100', fontSize: '9px', padding: '3px 5px' });
    });
    await page.screenshot(options);
  }
  return { browser, page, writes, errors, go, shot, settled, listingId, conversationId, api, listing, me, seller, user, session };
}
