#!/usr/bin/env node

// Test script for ultimate search API
// Run with: node test-ultimate-search.js

async function testUltimateSearch() {
  console.log('🚀 Testing Ultimate Search API...\n');
  
  const testCases = [
    { artist: '아이유', title: '좋은날' },
    { artist: 'IU', title: 'Good Day' },
    { artist: 'BTS', title: 'Dynamite' },
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${testCase.artist} - ${testCase.title}`);
    console.log('='.repeat(60));
    
    try {
      const response = await fetch('http://localhost:3000/api/lyrics/ultimate-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase),
      });
      
      console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('\n✅ Success! Results:');
        console.log(`  - Source: ${data.source}`);
        console.log(`  - Confidence: ${data.confidence}`);
        console.log(`  - Has Timestamps: ${data.hasTimestamps}`);
        console.log(`  - Lyrics Length: ${data.lyrics?.length || 0} chars`);
        console.log(`  - Line Count: ${data.metadata?.lineCount || 0}`);
        console.log(`  - Is Complete: ${data.metadata?.isComplete}`);
        console.log(`  - Total Results: ${data.totalResults}`);
        
        if (data.alternatives && data.alternatives.length > 0) {
          console.log('\n📋 Alternative sources:');
          data.alternatives.forEach(alt => {
            console.log(`    - ${alt.source}: ${alt.confidence} (complete: ${alt.isComplete})`);
          });
        }
        
        // Show first 300 chars of lyrics
        if (data.lyrics) {
          console.log('\n📝 Lyrics preview:');
          console.log(data.lyrics.substring(0, 300) + '...');
        }
      } else {
        const errorText = await response.text();
        console.log('\n❌ Error Response:', errorText);
      }
    } catch (error) {
      console.error('\n💥 Test failed with exception:', error.message);
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('✨ All tests completed!');
  console.log('='.repeat(60));
}

// Check if server is running
fetch('http://localhost:3000/api/lyrics/ultimate-search')
  .catch(() => {
    console.error('❌ Server is not running! Start it with: npm run dev');
    process.exit(1);
  })
  .then(() => testUltimateSearch())
  .catch(console.error);