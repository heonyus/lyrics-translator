import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Gemini API Key
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE || ''
);

// 일본어 발음 변환 프롬프트
const getJapanesePronunciationPrompt = (text: string) => `
당신은 일본어 노래 발음 전문가입니다.
한국인이 일본 노래를 따라 부를 수 있도록 정확한 한글 발음을 제공하세요.

중요 규칙:
1. 각 줄 그대로 유지하고 바로 아래에 [한글발음] 표기
2. 장음(ー)은 앞 모음을 늘려서 표기 (예: ター → 타-)
3. 촉음(っ)은 뒤 자음을 강조 (예: やっぱり → 얍파리)
4. 요음(きゃ,しゅ,ちょ 등) 정확히 표기
5. は는 조사일 때 '와', 일반적으로 '하'
6. を는 항상 '오'
7. ん은 위치에 따라 'ㄴ/ㅇ/ㅁ' 구분
8. 빈 줄은 그대로 유지

예시 형식:
君の名は
[키미노 나와]

ずっと前から
[즛토 마에카라]

好きでした
[스키데시타]

이제 다음 가사를 변환하세요:
${text}

주의: 원본 텍스트와 [발음]만 출력하세요. 설명이나 다른 텍스트는 포함하지 마세요.`;

// 영어 발음 변환 프롬프트
const getEnglishPronunciationPrompt = (text: string) => `
당신은 영어 노래 발음 전문가입니다.
한국인이 팝송을 따라 부를 수 있도록 자연스러운 한글 발음을 제공하세요.

중요 규칙:
1. 각 줄 그대로 유지하고 바로 아래에 [한글발음] 표기
2. 연음 처리 필수 (want it → 원릿)
3. 강세 있는 음절은 대문자로 표기
4. R은 부드럽게 'ㄹ' (car → 카ㄹ)
5. th는 문맥에 따라 'ㅆ/ㄷ' 구분
6. -ing은 '잉' (singing → 싱잉)
7. 축약형 정확히 (can't → 캔트, won't → 원트)
8. 빈 줄은 그대로 유지

예시 형식:
Never gonna give you up
[네버 거너 기브 유 업]

Never gonna let you down
[네버 거너 렛 유 다운]

이제 다음 가사를 변환하세요:
${text}

주의: 원본 텍스트와 [발음]만 출력하세요. 설명이나 다른 텍스트는 포함하지 마세요.`;

// 캐시 확인
async function checkPronunciationCache(text: string, language: string) {
  try {
    const { data, error } = await supabase
      .from('pronunciation_cache')
      .select('*')
      .eq('original_text', text)
      .eq('language', language)
      .single();

    if (error || !data) return null;

    // 7일 이상 된 캐시는 무시
    const cacheAge = Date.now() - new Date(data.created_at).getTime();
    if (cacheAge > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }

    return data.pronunciation;
  } catch (error) {
    return null;
  }
}

// 캐시 저장
async function savePronunciationCache(text: string, language: string, pronunciation: string) {
  try {
    await supabase
      .from('pronunciation_cache')
      .upsert({
        original_text: text,
        language,
        pronunciation,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

// Gemini API 호출
async function callGeminiAPI(prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 4096,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_ONLY_HIGH"
          }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || '';
}

// 언어 감지
function detectLanguage(text: string): string {
  const hasJapanese = /[ぁ-んァ-ン一-龯]/.test(text);
  const hasKorean = /[가-힣]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  
  if (hasJapanese) return 'ja';
  if (hasKorean) return 'ko';
  if (hasEnglish) return 'en';
  
  return 'unknown';
}

// 발음 변환 결과 정리
function cleanPronunciationResult(text: string): string {
  // 불필요한 설명 제거
  let cleaned = text;
  cleaned = cleaned.replace(/^.*?(설명|주의|참고).*$/gm, '');
  cleaned = cleaned.replace(/^```.*$/gm, '');
  cleaned = cleaned.trim();
  
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = 'ko' } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }
    
    // 언어 감지
    const detectedLanguage = detectLanguage(text);
    
    // 한국어는 그대로 반환
    if (detectedLanguage === 'ko') {
      return NextResponse.json({
        success: true,
        pronunciation: text,
        originalText: text,
        detectedLanguage: 'ko',
        targetLanguage: targetLang,
        cached: false
      });
    }
    
    // 지원하지 않는 언어
    if (detectedLanguage === 'unknown') {
      return NextResponse.json({
        success: true,
        pronunciation: text,
        originalText: text,
        detectedLanguage: 'unknown',
        targetLanguage: targetLang,
        cached: false
      });
    }
    
    // 캐시 확인
    const cached = await checkPronunciationCache(text, detectedLanguage);
    if (cached) {
      console.log('✅ Pronunciation cache hit');
      return NextResponse.json({
        success: true,
        pronunciation: cached,
        originalText: text,
        detectedLanguage,
        targetLanguage: targetLang,
        cached: true
      });
    }
    
    // AI 발음 변환
    let pronunciation = '';
    
    try {
      if (detectedLanguage === 'ja') {
        // 일본어 발음 변환
        const prompt = getJapanesePronunciationPrompt(text);
        pronunciation = await callGeminiAPI(prompt);
      } else if (detectedLanguage === 'en') {
        // 영어 발음 변환
        const prompt = getEnglishPronunciationPrompt(text);
        pronunciation = await callGeminiAPI(prompt);
      }
      
      // 결과 정리
      pronunciation = cleanPronunciationResult(pronunciation);
      
      // 캐시 저장
      await savePronunciationCache(text, detectedLanguage, pronunciation);
      
    } catch (error) {
      console.error('Gemini API error, falling back to simple conversion:', error);
      
      // Fallback: 간단한 변환
      if (detectedLanguage === 'ja') {
        pronunciation = convertJapaneseSimple(text);
      } else if (detectedLanguage === 'en') {
        pronunciation = convertEnglishSimple(text);
      }
    }
    
    return NextResponse.json({
      success: true,
      pronunciation,
      originalText: text,
      detectedLanguage,
      targetLanguage: targetLang,
      cached: false
    });
    
  } catch (error) {
    console.error('Pronunciation conversion error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Pronunciation conversion failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Fallback: 간단한 일본어 변환
function convertJapaneseSimple(text: string): string {
  const hiraganaMap: { [key: string]: string } = {
    'あ': '아', 'い': '이', 'う': '우', 'え': '에', 'お': '오',
    'か': '카', 'き': '키', 'く': '쿠', 'け': '케', 'こ': '코',
    'が': '가', 'ぎ': '기', 'ぐ': '구', 'げ': '게', 'ご': '고',
    'さ': '사', 'し': '시', 'す': '스', 'せ': '세', 'そ': '소',
    'ざ': '자', 'じ': '지', 'ず': '즈', 'ぜ': '제', 'ぞ': '조',
    'た': '타', 'ち': '치', 'つ': '츠', 'て': '테', 'と': '토',
    'だ': '다', 'ぢ': '지', 'づ': '즈', 'で': '데', 'ど': '도',
    'な': '나', 'に': '니', 'ぬ': '누', 'ね': '네', 'の': '노',
    'は': '하', 'ひ': '히', 'ふ': '후', 'へ': '헤', 'ほ': '호',
    'ば': '바', 'び': '비', 'ぶ': '부', 'べ': '베', 'ぼ': '보',
    'ぱ': '파', 'ぴ': '피', 'ぷ': '푸', 'ぺ': '페', 'ぽ': '포',
    'ま': '마', 'み': '미', 'む': '무', 'め': '메', 'も': '모',
    'や': '야', 'ゆ': '유', 'よ': '요',
    'ら': '라', 'り': '리', 'る': '루', 'れ': '레', 'ろ': '로',
    'わ': '와', 'を': '오', 'ん': 'ㄴ',
  };
  
  const lines = text.split('\n');
  const result: string[] = [];
  
  for (const line of lines) {
    if (!line.trim()) {
      result.push('');
      continue;
    }
    
    result.push(line);
    
    let pronunciation = line;
    for (const [ja, ko] of Object.entries(hiraganaMap)) {
      pronunciation = pronunciation.replace(new RegExp(ja, 'g'), ko);
    }
    
    if (pronunciation !== line) {
      result.push(`[${pronunciation}]`);
    }
  }
  
  return result.join('\n');
}

// Fallback: 간단한 영어 변환
function convertEnglishSimple(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  
  const basicMap: { [key: string]: string } = {
    'the': '더', 'The': '더',
    'and': '앤드', 'And': '앤드',
    'you': '유', 'You': '유',
    'me': '미', 'Me': '미',
    'love': '러브', 'Love': '러브',
    'heart': '하트', 'Heart': '하트',
    'time': '타임', 'Time': '타임',
    'life': '라이프', 'Life': '라이프',
    'world': '월드', 'World': '월드',
    'never': '네버', 'Never': '네버',
    'forever': '포에버', 'Forever': '포에버',
    'together': '투게더', 'Together': '투게더',
  };
  
  for (const line of lines) {
    if (!line.trim()) {
      result.push('');
      continue;
    }
    
    result.push(line);
    
    let pronunciation = line.toLowerCase();
    
    // 기본 단어 변환
    for (const [en, ko] of Object.entries(basicMap)) {
      pronunciation = pronunciation.replace(new RegExp(`\\b${en.toLowerCase()}\\b`, 'g'), ko);
    }
    
    // 매우 기본적인 음절 변환
    pronunciation = pronunciation
      .replace(/ing\b/g, '잉')
      .replace(/tion\b/g, '션')
      .replace(/er\b/g, '어')
      .replace(/ly\b/g, '리')
      .replace(/ed\b/g, '드');
    
    if (pronunciation !== line.toLowerCase()) {
      result.push(`[${pronunciation}]`);
    }
  }
  
  return result.join('\n');
}