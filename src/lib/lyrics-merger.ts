// 가사 병합 및 선택 유틸리티

interface LyricsCandidate {
  lyrics: string;
  source: string;
  confidence: number;
  hasTimestamps: boolean;
  metadata?: any;
}

// 가사 완전성 점수 계산
export function calculateCompletenessScore(lyrics: string): number {
  if (!lyrics) return 0;
  
  let score = 0;
  
  // 길이 점수 (0-30점)
  const length = lyrics.length;
  if (length > 1500) score += 30;
  else if (length > 1000) score += 25;
  else if (length > 700) score += 20;
  else if (length > 500) score += 15;
  else if (length > 300) score += 10;
  else score += 5;
  
  // 줄 수 점수 (0-20점)
  const lines = lyrics.split('\n').filter(l => l.trim());
  if (lines.length > 40) score += 20;
  else if (lines.length > 30) score += 15;
  else if (lines.length > 20) score += 10;
  else if (lines.length > 10) score += 5;
  
  // 구조 점수 (0-30점)
  const hasVerse1 = lyrics.includes('Verse 1') || lyrics.includes('[Verse 1]') || lyrics.includes('1절');
  const hasVerse2 = lyrics.includes('Verse 2') || lyrics.includes('[Verse 2]') || lyrics.includes('2절');
  const hasChorus = lyrics.includes('Chorus') || lyrics.includes('[Chorus]') || lyrics.includes('후렴');
  const hasBridge = lyrics.includes('Bridge') || lyrics.includes('[Bridge]') || lyrics.includes('브릿지');
  
  if (hasVerse1) score += 10;
  if (hasVerse2) score += 10;
  if (hasChorus) score += 7;
  if (hasBridge) score += 3;
  
  // 문단 점수 (0-20점)
  const paragraphs = lyrics.split('\n\n').filter(p => p.trim().length > 20);
  if (paragraphs.length > 5) score += 20;
  else if (paragraphs.length > 4) score += 15;
  else if (paragraphs.length > 3) score += 10;
  else if (paragraphs.length > 2) score += 5;
  
  return score;
}

// 두 가사가 같은 노래인지 확인
export function areSameSong(lyrics1: string, lyrics2: string): boolean {
  if (!lyrics1 || !lyrics2) return false;
  
  const lines1 = lyrics1.split('\n').filter(l => l.trim()).slice(0, 5);
  const lines2 = lyrics2.split('\n').filter(l => l.trim()).slice(0, 5);
  
  // 첫 5줄 중 2줄 이상 일치하면 같은 노래
  let matches = 0;
  for (const line1 of lines1) {
    for (const line2 of lines2) {
      if (line1.toLowerCase().includes(line2.toLowerCase()) || 
          line2.toLowerCase().includes(line1.toLowerCase())) {
        matches++;
        break;
      }
    }
  }
  
  return matches >= 2;
}

// 가사 병합 (두 가사를 지능적으로 병합)
export function mergeLyrics(primary: string, secondary: string): string {
  if (!primary) return secondary || '';
  if (!secondary) return primary || '';
  
  // 같은 노래가 아니면 더 긴 것 반환
  if (!areSameSong(primary, secondary)) {
    return primary.length > secondary.length ? primary : secondary;
  }
  
  const primaryLines = primary.split('\n');
  const secondaryLines = secondary.split('\n');
  
  const merged: string[] = [];
  const used = new Set<number>();
  
  // Primary 기준으로 병합
  for (const pLine of primaryLines) {
    merged.push(pLine);
    
    // Secondary에서 비슷한 위치의 추가 내용 찾기
    for (let i = 0; i < secondaryLines.length; i++) {
      if (used.has(i)) continue;
      
      const sLine = secondaryLines[i];
      
      // 구조 표시자면 추가
      if (sLine.match(/^\[.*\]$/) && !pLine.match(/^\[.*\]$/)) {
        merged.push(sLine);
        used.add(i);
        break;
      }
    }
  }
  
  // Secondary에만 있는 내용 추가
  for (let i = 0; i < secondaryLines.length; i++) {
    if (used.has(i)) continue;
    const sLine = secondaryLines[i];
    
    // 2절이나 브릿지 등 추가 내용
    if (sLine.includes('2절') || sLine.includes('Verse 2') || 
        sLine.includes('Bridge') || sLine.includes('[Bridge]')) {
      // 적절한 위치 찾기
      let inserted = false;
      for (let j = merged.length - 1; j >= 0; j--) {
        if (merged[j].includes('1절') || merged[j].includes('Verse 1') || 
            merged[j].includes('Chorus') || merged[j].includes('후렴')) {
          // 그 다음에 삽입
          const remaining = secondaryLines.slice(i);
          const verse2Content = [];
          for (const line of remaining) {
            verse2Content.push(line);
            if (line.trim() === '' && verse2Content.length > 3) break;
          }
          merged.splice(j + 1, 0, '', ...verse2Content);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        merged.push('', sLine);
      }
      used.add(i);
    }
  }
  
  // 중복 제거 및 정리
  const cleaned: string[] = [];
  let lastLine = '';
  for (const line of merged) {
    if (line.trim() !== lastLine.trim() || line.trim() === '') {
      cleaned.push(line);
      lastLine = line;
    }
  }
  
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n');
}

// 최적의 가사 선택 또는 병합
export function selectBestLyrics(candidates: LyricsCandidate[]): LyricsCandidate | null {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  
  // 각 후보의 점수 계산
  const scored = candidates.map(c => ({
    ...c,
    completenessScore: calculateCompletenessScore(c.lyrics),
    lengthScore: c.lyrics.length,
    priorityScore: 
      c.source.includes('genius') ? 100 :
      c.source.includes('melon-full') ? 95 :
      c.source.includes('lrclib') && c.hasTimestamps ? 90 :
      c.source.includes('bugs') ? 70 :
      c.source.includes('vibe') ? 75 :
      50
  }));
  
  // 정렬: 완전성 > 우선순위 > 길이
  scored.sort((a, b) => {
    // 완전성 점수 차이가 크면 우선
    if (Math.abs(a.completenessScore - b.completenessScore) > 10) {
      return b.completenessScore - a.completenessScore;
    }
    // 우선순위 점수
    if (Math.abs(a.priorityScore - b.priorityScore) > 10) {
      return b.priorityScore - a.priorityScore;
    }
    // 길이
    return b.lengthScore - a.lengthScore;
  });
  
  const best = scored[0];
  
  // 최고 점수가 낮으면 병합 시도
  if (best.completenessScore < 70 && scored.length > 1) {
    // 상위 2개 병합
    const merged = mergeLyrics(best.lyrics, scored[1].lyrics);
    const mergedScore = calculateCompletenessScore(merged);
    
    // 병합 결과가 더 좋으면 사용
    if (mergedScore > best.completenessScore) {
      return {
        lyrics: merged,
        source: `${best.source}+${scored[1].source}`,
        confidence: Math.max(best.confidence, scored[1].confidence),
        hasTimestamps: best.hasTimestamps || scored[1].hasTimestamps,
        metadata: {
          ...best.metadata,
          merged: true,
          sources: [best.source, scored[1].source],
          completenessScore: mergedScore
        }
      };
    }
  }
  
  return {
    ...best,
    metadata: {
      ...best.metadata,
      completenessScore: best.completenessScore
    }
  };
}

// 가사가 1절만 있는지 확인
export function isOnlyFirstVerse(lyrics: string): boolean {
  if (!lyrics) return true;
  
  const hasSecondVerse = 
    lyrics.includes('2절') || 
    lyrics.includes('Verse 2') || 
    lyrics.includes('[Verse 2]') ||
    lyrics.includes('두 번째');
  
  const paragraphs = lyrics.split('\n\n').filter(p => p.trim().length > 20);
  const lines = lyrics.split('\n').filter(l => l.trim());
  
  // 2절이 없고, 문단이 3개 이하이고, 500자 미만이면 1절만
  return !hasSecondVerse && paragraphs.length <= 3 && lyrics.length < 500 && lines.length < 15;
}

// 가사 정리 및 포맷팅
export function formatLyrics(lyrics: string): string {
  if (!lyrics) return '';
  
  return lyrics
    .replace(/\r\n/g, '\n') // 줄바꿈 통일
    .replace(/\n{3,}/g, '\n\n') // 과도한 줄바꿈 제거
    .replace(/^\s+|\s+$/g, '') // 앞뒤 공백 제거
    .replace(/\t/g, '  ') // 탭을 공백으로
    .split('\n')
    .map(line => line.trimEnd()) // 각 줄 끝 공백 제거
    .join('\n');
}