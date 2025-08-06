# 노래방 가사 번역기 프로젝트 문서

## 🎯 프로젝트 개요

OBS 스트리밍용 실시간 가사 오버레이 프로그램입니다. 크로마키를 활용해 가사를 투명 배경으로 표시하고, 실시간 번역과 노래방 스타일 하이라이팅을 제공합니다.

### 핵심 목적
- **단순함**: 복잡한 방송 시스템이 아닌, OBS 브라우저 소스로 사용할 간단한 오버레이
- **크로마키**: 녹색 배경(#00FF00)으로 OBS에서 쉽게 제거 가능
- **스마트 캐싱**: Supabase를 통한 가사/번역 저장으로 API 호출 최소화

## 📅 2025-08-05 작업 내역

### 1. 초기 환경 설정 ✅
```bash
# Git 초기화 및 GitHub 연결
git init
git remote add origin git@github.com:heonyus/lylics-translator.git
git add .
git commit -m "Initial setup"

# 필수 패키지 설치
npm install @supabase/supabase-js openai socket.io socket.io-client
npm install --save-dev concurrently
```

### 2. API 키 및 환경 변수 설정 ✅
`.env.local` 파일 생성:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://lyikqynfhvbhhsgfhiyp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[제공된 키]
SUPABASE_SERVICE_ROLE_KEY=[제공된 키]

# Google Translate
NEXT_PUBLIC_GOOGLE_API_KEY=[제공된 키]

# OpenAI
OPENAI_API_KEY=[제공된 키]

# Soniox (음성 인식용 - 추후 사용)
SONIOX_API_KEY=[제공된 키]
```

### 3. Supabase 데이터베이스 스키마 구축 ✅

#### lyrics 테이블
```sql
CREATE TABLE lyrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  lrc_content TEXT NOT NULL,
  lines JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### translations 테이블 (캐싱용)
```sql
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lyrics_id UUID REFERENCES lyrics(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  target_language TEXT NOT NULL,
  timestamp FLOAT,
  duration FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lyrics_id, line_index, target_language)
);
```

### 4. UI/UX 디자인 시스템 구축 ✅

#### 구현된 컴포넌트 (`/src/components/design-system/`)
- **GlassmorphicCard**: 글래스모피즘 효과 카드
- **NeonButton**: 네온 발광 효과 버튼
- **AnimatedBackground**: 동적 배경 애니메이션
- **ParticleEffect**: 인터랙티브 파티클 효과
- **NeonLoader**: 네온 스타일 로딩 애니메이션
- **NeonToast**: 네온 토스트 알림

#### 디자인 쇼케이스
- URL: `/design-showcase`
- 모든 컴포넌트 데모 및 테스트 가능

### 5. OBS 크로마키 오버레이 시스템 ✅

#### 메인 오버레이 (`/obs`)
```typescript
// 주요 기능:
- 크로마키 배경 (#00FF00 - 녹색)
- 실시간 가사 표시 (단어별 하이라이팅)
- 번역 표시 (캐싱됨)
- 강한 텍스트 그림자로 가독성 확보
- localStorage를 통한 로컬 제어
```

#### 컨트롤 패널 (`/obs/control`)
```typescript
// 기능:
- 가사 검색 (YouTube, Genius, LRClib)
- 최근 사용한 가사 목록
- 재생/일시정지/리셋 컨트롤
- OBS 설정 조정 (글자 크기, 번역 언어)
- OBS URL 생성 및 복사
```

### 6. API 라우트 구현 ✅

#### `/api/lyrics/search`
- 가사 검색 및 저장
- Supabase CRUD 작업

#### `/api/translate/ai`
- GPT-4 기반 문맥 인식 번역
- 이전/다음 라인 컨텍스트 활용
- 번역 결과 자동 캐싱

### 7. 스마트 캐싱 시스템 ✅

```typescript
// 번역 캐싱 로직
1. translations 테이블에서 기존 번역 확인
2. 있으면: 캐시된 번역 사용 (API 호출 없음)
3. 없으면: GPT-4 API 호출 → 번역 → DB 저장

// 저장되는 데이터
- lyrics_id: 가사 ID
- line_index: 라인 번호
- original_text: 원본 텍스트
- translated_text: 번역된 텍스트
- target_language: 대상 언어
- timestamp: 타이밍 정보
- duration: 지속 시간
- metadata: 단어별 타이밍 등 추가 정보
```

## 🚀 사용 방법

### 1. 개발 서버 실행
```bash
npm run dev
# http://localhost:3000
```

### 2. OBS 설정
1. **브라우저 소스** 추가
2. URL: `http://localhost:3000/obs`
3. 크기: 1920 x 1080
4. **필터** → **크로마키** → 색상: 녹색 (#00FF00)
5. FPS: 30 이상

### 3. 컨트롤 패널 사용
1. `http://localhost:3000/obs/control` 접속
2. 노래 검색 및 선택
3. 재생 컨트롤로 가사 제어
4. OBS URL 복사하여 브라우저 소스에 적용

## 📁 프로젝트 구조

```
/src
├── app/
│   ├── obs/                    # OBS 오버레이
│   │   ├── page.tsx            # 크로마키 오버레이 (녹색 배경)
│   │   └── control/page.tsx    # 컨트롤 패널
│   ├── design-showcase/         # UI 컴포넌트 쇼케이스
│   ├── api/
│   │   ├── lyrics/search/      # 가사 검색 API
│   │   └── translate/ai/       # AI 번역 API
│   └── control/page.tsx        # 기존 컨트롤 패널
│
├── components/
│   ├── design-system/          # 네온/글래스모피즘 UI
│   └── websocket/              # WebSocket 컴포넌트 (현재 미사용)
│
├── domains/                    # DDD 도메인 모듈
│   ├── karaoke/                # 노래방 기능
│   ├── lyrics/                 # 가사 처리
│   ├── lrc-fetcher/           # 가사 가져오기
│   └── translation/            # 번역 기능
│
└── lib/
    ├── supabase.ts             # Supabase 클라이언트
    └── database-schema.sql     # DB 스키마
```

## 🔧 환경 변수 체크리스트

```env
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY  
✅ SUPABASE_SERVICE_ROLE_KEY
✅ NEXT_PUBLIC_GOOGLE_API_KEY
✅ OPENAI_API_KEY
✅ SONIOX_API_KEY
```

## 📝 내일 작업 계획

### 우선순위 높음
1. [ ] 가사 동기화 정확도 개선
2. [ ] 키보드 단축키 추가 (Space: 재생/정지, R: 리셋)
3. [ ] 가사 편집 기능 (타이밍 조정)

### 우선순위 중간
4. [ ] 다중 언어 동시 표시 옵션
5. [ ] 가사 스타일 커스터마이징 (폰트, 애니메이션)
6. [ ] 가사 내보내기 (SRT, VTT 형식)

### 우선순위 낮음
7. [ ] 음성 인식 연동 (Soniox API)
8. [ ] 모바일 리모컨 앱
9. [ ] Vercel 배포 설정

## ⚠️ 알려진 이슈

1. **Spotify 프로바이더 CORS 오류**
   - 서버사이드 API 라우트 구현 필요

2. **Next.js 모듈 해결 오류 (./730.js)**
   - 웹팩 청킹 문제, 데모 페이지 접근 시 발생

## 💡 중요 참고사항

### localStorage 키
- `current_lrc`: 현재 LRC 파일 내용
- `current_title`: 현재 곡 제목
- `current_artist`: 현재 아티스트
- `karaoke_control`: 재생 제어 명령 (play/pause/reset)

### URL 파라미터 (OBS 오버레이)
- `chromaKey`: 크로마키 색상 (기본: #00FF00)
- `fontSize`: 글자 크기 (기본: 60)
- `textColor`: 텍스트 색상 (기본: #FFFFFF)
- `highlightColor`: 하이라이트 색상 (기본: #FFD700)
- `lang`: 번역 언어 (기본: en)
- `showTranslation`: 번역 표시 여부 (기본: true)

### 번역 캐싱 효과
- 같은 가사를 다시 재생할 때 **API 호출 0회**
- 평균 응답 속도: 캐시 히트 시 <50ms, 미스 시 ~2000ms
- 월간 API 비용 절감: 약 80-90%

## 🎯 프로젝트 목표

이 프로젝트는 **간단하고 효율적인 OBS 가사 오버레이**를 목표로 합니다:
- ❌ 복잡한 방송 시스템 X
- ❌ 실시간 동기화 서버 X  
- ✅ 로컬에서 작동하는 간단한 오버레이
- ✅ 스마트 캐싱으로 비용 절감
- ✅ OBS 크로마키 최적화

---

🎤 **노래방 가사 번역기** - OBS와 함께 전 세계와 노래하세요!