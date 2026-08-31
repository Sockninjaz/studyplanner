const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  
  console.log('Navigating to exams...');
  await page.goto('http://localhost:3000/exams', { waitUntil: 'networkidle2' });
  
  const exams = await page.$$('a[href^="/exams/"]');
  if (exams.length === 0) { console.log('No exams found.'); process.exit(1); }
  
  const examUrl = await (await exams[0].getProperty('href')).jsonValue();
  console.log('Going to exam:', examUrl);
  await page.goto(examUrl, { waitUntil: 'networkidle2' });
  
  const sessions = await page.$$('a[href^="/session/"]');
  if (sessions.length === 0) { console.log('No sessions found.'); process.exit(1); }
  
  const sessionUrl = await (await sessions[0].getProperty('href')).jsonValue();
  console.log('Going to session:', sessionUrl);
  await page.goto(sessionUrl, { waitUntil: 'networkidle2' });
  
  console.log('Starting timer...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const startBtn = buttons.find(b => b.textContent.includes('Session') || b.textContent.includes('Start'));
    if (startBtn) startBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Clicking sidebar exams link...');
  await page.evaluate(() => {
    const link = document.querySelector('a[href="/exams"]');
    if (link) link.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const widgetHtml = await page.evaluate(() => {
    const widget = document.querySelector('.fixed.bottom-6');
    return widget ? widget.outerHTML : 'NOT_FOUND';
  });
  
  console.log('Widget HTML:', widgetHtml);
  
  await browser.close();
})();
