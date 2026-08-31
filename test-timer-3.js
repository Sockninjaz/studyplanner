const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Intercept console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERR:', err.toString()));
  
  console.log('[Test] Going to homepage...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  // Wait a bit to ensure it fully hydrated
  await new Promise(r => setTimeout(r, 2000));
  
  // Log the HTML of the body
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('[Test] Body text snippet:', bodyText.substring(0, 200));

  const debugBox = await page.evaluate(() => {
    const el = document.querySelector('.fixed.top-0.right-0');
    return el ? el.innerText : 'NOT FOUND';
  });
  console.log('[Test] Debug box:', debugBox);

  // We need to login to test navigation? Or does the app let us do things without login?
  // Let's just create a dummy localStorage state as if a session was started
  console.log('[Test] Injecting fake session into localStorage...');
  await page.evaluate(() => {
    localStorage.setItem('studyTimerState', JSON.stringify({
      activeSessionId: 'test-session-123',
      activeSessionData: { title: 'Test Session' },
      mode: 'session',
      timeLeft: 1400,
      isPaused: false,
      sessionCount: 0,
      tasks: [],
      currentTaskId: null,
      endTime: Date.now() + 1400000,
      duration: 60,
      savedSessionTime: null
    }));
  });

  // Reload to let TimerProvider pick it up
  console.log('[Test] Reloading page to trigger TimerProvider...');
  await page.goto('http://localhost:3000/exams', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const debugBox2 = await page.evaluate(() => {
    const el = document.querySelector('.fixed.top-0.right-0');
    return el ? el.innerText : 'NOT FOUND';
  });
  console.log('[Test] Debug box after reload:', debugBox2);
  
  const widgetHtml = await page.evaluate(() => {
    const el = document.querySelector('a[href*="/session/test-session-123"]');
    return el ? el.outerHTML : 'WIDGET NOT FOUND';
  });
  console.log('[Test] Widget HTML:', widgetHtml);

  await browser.close();
})();
