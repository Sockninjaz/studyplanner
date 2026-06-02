const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Go to a session directly (assuming we have one, or just the exams page)
  console.log('Navigating to exams page...');
  await page.goto('http://localhost:3000/exams');
  
  // Wait for network idle
  await page.waitForNetworkIdle();
  
  console.log('Finding an exam link...');
  // Find an exam link
  const examLinks = await page.$$('a[href^="/exams/"]');
  if (examLinks.length === 0) {
    console.log('No exams found.');
    await browser.close();
    return;
  }
  
  // Click first exam to get to session page
  const examUrl = await (await examLinks[0].getProperty('href')).jsonValue();
  console.log('Navigating to exam:', examUrl);
  await page.goto(examUrl);
  await page.waitForNetworkIdle();
  
  // Find a session link
  const sessionLinks = await page.$$('a[href^="/session/"]');
  if (sessionLinks.length === 0) {
    console.log('No sessions found.');
    await browser.close();
    return;
  }
  
  const sessionUrl = await (await sessionLinks[0].getProperty('href')).jsonValue();
  console.log('Navigating to session:', sessionUrl);
  await page.goto(sessionUrl);
  await page.waitForNetworkIdle();
  
  // Start the timer
  console.log('Starting the timer...');
  const startButton = await page.$('button.bg-blue-500'); // Session button
  if (startButton) {
    await startButton.click();
    console.log('Clicked Session button.');
  } else {
    // Maybe it's a different button text
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Start') || text.includes('Session')) {
        await btn.click();
        console.log('Clicked button:', text);
        break;
      }
    }
  }
  
  await new Promise(r => setTimeout(r, 1000)); // wait for state update
  
  // Check if timer is running
  const timerText = await page.evaluate(() => {
    const el = document.querySelector('.text-5xl');
    return el ? el.textContent : null;
  });
  console.log('Timer display:', timerText);
  
  // Now click the Exams link in the sidebar
  console.log('Clicking Exams in sidebar...');
  const sidebarLinks = await page.$$('a[href="/exams"]');
  if (sidebarLinks.length > 0) {
    // Listen for frame navigation to see if it hard reloads
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        console.log('MAIN FRAME NAVIGATED (HARD RELOAD)');
      }
    });
    
    await sidebarLinks[0].click();
    console.log('Clicked sidebar link, waiting for navigation...');
    
    // Wait a bit for React to render the new page
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if GlobalTimerWidget exists
    const widget = await page.$('.fixed.bottom-6');
    if (widget) {
      console.log('SUCCESS: Global timer widget IS present on the page.');
      const widgetText = await page.evaluate(el => el.textContent, widget);
      console.log('Widget text:', widgetText);
    } else {
      console.log('ERROR: Global timer widget IS NOT present.');
      
      // Let's check if the URL changed
      console.log('Current URL:', page.url());
      
      // Check for hydration errors in console
      console.log('Checking for errors...');
    }
  } else {
    console.log('Could not find Exams link in sidebar.');
  }

  await browser.close();
})();
