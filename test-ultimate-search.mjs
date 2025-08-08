#!/usr/bin/env node

// Test Ultimate Search API
async function testUltimateSearch() {
  console.log('🧪 Testing Ultimate Search API...');
  
  const tests = [
    { artist: 'IU', title: 'Good Day' },
    { artist: '아이유', title: '좋은날' },
    { artist: 'BTS', title: 'Dynamite' },
    { artist: '星野源', title: '恋' }
  ];
  
  for (const test of tests) {
    console.log(`\n📍 Testing: ${test.artist} - ${test.title}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/lyrics/ultimate-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test)
      });
      
      if (!response.ok) {
        console.error(`  ❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.lyrics) {
        console.log(`  ✅ Found lyrics from ${data.source}`);
        console.log(`     Confidence: ${data.confidence}`);
        console.log(`     Length: ${data.lyrics.length} chars`);
        console.log(`     Has timestamps: ${data.hasTimestamps}`);
        console.log(`     Total results: ${data.totalResults}`);
        if (data.alternatives) {
          console.log(`     Alternatives: ${data.alternatives.length}`);
        }
      } else if (data.error) {
        console.error(`  ❌ Error: ${data.error}`);
      } else {
        console.error(`  ❌ No lyrics found`);
      }
    } catch (error) {
      console.error(`  ❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\n✨ Test complete!');
}

// Wait for server to be ready
console.log('Waiting for server to start...');
setTimeout(() => {
  testUltimateSearch().catch(console.error);
}, 3000);