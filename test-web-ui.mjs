#!/usr/bin/env node
import puppeteer from 'puppeteer';

async function testWebUI() {
  console.log('🌐 Testing Web UI with Ultimate Search...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Listen for console logs
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log('  Browser:', msg.text());
      }
    });
    
    // Navigate to the app
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    console.log('✅ Page loaded');
    
    // Test searches
    const searches = [
      '아이유 좋은날',
      'BTS Dynamite', 
      '星野源 恋'
    ];
    
    for (const query of searches) {
      console.log(`\n🔍 Testing search: "${query}"`);
      
      // Type in search box
      await page.type('input[placeholder*="검색"]', query, { delay: 50 });
      
      // Click search button or press Enter
      await page.keyboard.press('Enter');
      
      // Wait for results
      await page.waitForSelector('[data-testid="search-results"], [class*="result"]', { 
        timeout: 10000 
      }).catch(() => console.log('  ⏱️ Timeout waiting for results'));
      
      // Check if results appeared
      const resultsCount = await page.evaluate(() => {
        const results = document.querySelectorAll('[data-testid="search-result"], [class*="result-item"], [class*="lyrics"]');
        return results.length;
      });
      
      console.log(`  📊 Found ${resultsCount} result elements`);
      
      // Clear search box
      await page.evaluate(() => {
        const input = document.querySelector('input[placeholder*="검색"]');
        if (input) input.value = '';
      });
    }
    
    console.log('\n✨ Web UI test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testWebUI().catch(console.error);