#!/usr/bin/env node

// 완전한 가사 테스트
async function testCompleteLyrics() {
  console.log('🧪 Testing Complete Lyrics System...\n');
  
  const tests = [
    { artist: '다이나믹듀오', title: '죽일놈', expected: 'Korean rap with full verses' },
    { artist: '아이유', title: '좋은날', expected: 'Korean ballad with 2 verses' },
    { artist: 'BTS', title: 'Dynamite', expected: 'English pop with full structure' },
    { artist: '빅뱅', title: '뱅뱅뱅', expected: 'Korean dance with repetitive chorus' },
  ];
  
  for (const test of tests) {
    console.log(`\n📍 Testing: ${test.artist} - ${test.title}`);
    console.log(`   Expected: ${test.expected}`);
    console.log('   ' + '='.repeat(50));
    
    try {
      const response = await fetch('http://localhost:3000/api/lyrics/ultimate-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test)
      });
      
      if (!response.ok) {
        console.error(`   ❌ HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.lyrics) {
        console.log(`   ✅ Source: ${data.source}`);
        console.log(`   📏 Length: ${data.lyrics.length} chars`);
        console.log(`   📝 Lines: ${data.metadata?.lineCount || data.lyrics.split('\n').length}`);
        console.log(`   ✔️ Complete: ${data.metadata?.isComplete ? 'YES' : 'NO'}`);
        console.log(`   🎯 Confidence: ${(data.confidence * 100).toFixed(0)}%`);
        
        // 구조 분석
        const has2ndVerse = data.lyrics.includes('2절') || 
                           data.lyrics.includes('Verse 2') || 
                           data.lyrics.includes('[Verse 2]');
        const hasChorus = data.lyrics.includes('후렴') || 
                         data.lyrics.includes('Chorus') || 
                         data.lyrics.includes('[Chorus]');
        
        console.log(`   📋 Structure:`);
        console.log(`      - 2nd Verse: ${has2ndVerse ? '✅' : '❌'}`);
        console.log(`      - Chorus: ${hasChorus ? '✅' : '❌'}`);
        
        // 첫 10줄 미리보기
        const preview = data.lyrics.split('\n').slice(0, 10).join('\n');
        console.log(`\n   🎵 Preview:\n${preview.split('\n').map(l => '      ' + l).join('\n')}`);
        
        if (data.alternatives && data.alternatives.length > 0) {
          console.log(`\n   🔄 Alternatives: ${data.alternatives.length}`);
          data.alternatives.forEach(alt => {
            console.log(`      - ${alt.source}: ${alt.isComplete ? '✅ Complete' : '⚠️ Partial'}`);
          });
        }
        
      } else {
        console.error(`   ❌ No lyrics found`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Test complete!\n');
}

// 서버가 준비될 때까지 대기
console.log('Waiting for server...');
setTimeout(() => {
  testCompleteLyrics().catch(console.error);
}, 2000);