# 🎤 Lyrics Translator - OBS 스트리밍용 실시간 가사 번역 오버레이

OBS 스트리밍을 위한 실시간 노래방 스타일 가사 표시 및 번역 시스템입니다. 크로마키 배경으로 방송 화면에 자연스럽게 오버레이되며, GPT-4 기반 고품질 번역을 제공합니다.

![Next.js](https://img.shields.io/badge/Next.js-15.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![React](https://img.shields.io/badge/React-19.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-Enabled-green)
![WebSocket](https://img.shields.io/badge/WebSocket-Ready-orange)

## 📖 목차

- [핵심 기능](#-핵심-기능)
- [빠른 시작 가이드](#-빠른-시작-가이드)
- [상세 사용법](#-상세-사용법)
- [OBS 설정 가이드](#-obs-설정-가이드)
- [문제 해결](#-문제-해결)

## ✨ 핵심 기능

### 🎯 자동 가사 검색 및 동기화
- **다중 소스 검색**: YouTube, Spotify, Genius, LRClib에서 자동 검색
- **스마트 매칭**: AI 기반 정확도 점수로 최적의 가사 선택
- **타이밍 동기화**: 단어별 정확한 타이밍으로 노래방 스타일 표시

### 🌍 실시간 번역
- **GPT-4 기반**: 문맥을 이해하는 고품질 번역
- **스마트 캐싱**: Supabase를 통한 번역 저장으로 API 비용 80-90% 절감
- **20개 이상 언어 지원**: 한국어, 영어, 일본어, 중국어 등

### 📺 OBS 최적화
- **크로마키 배경**: 녹색 배경(#00FF00)으로 완벽한 투명 처리
- **60 FPS 지원**: 프레임 드롭 감지 및 보간으로 부드러운 애니메이션
- **실시간 제어**: 별도 컨트롤 패널로 방송 중 실시간 조작

### 🔄 실시간 동기화
- **WebSocket 통신**: 여러 디바이스 간 실시간 동기화
- **방 생성/참여**: 호스트와 뷰어 시스템으로 협업 가능
- **동기화된 재생**: 모든 참가자가 같은 타이밍에 가사 확인

## 🚀 빠른 시작 가이드

### 📋 필수 요구사항

- Node.js 20.0 이상
- npm 또는 yarn
- Supabase 프로젝트 (무료 가능)
- OpenAI API 키 (GPT-4 번역용)
- Google Cloud API 키 (대체 번역용, 선택사항)

### ⚙️ 설치 및 실행

#### 1. 프로젝트 클론 및 설치

```bash
# 저장소 클론
git clone https://github.com/heonyus/lyrics-translator.git
cd lyrics-translator

# 의존성 설치
npm install
```

#### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Supabase (필수) - https://supabase.com 에서 무료 프로젝트 생성
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI (필수) - https://platform.openai.com/api-keys 에서 키 생성
OPENAI_API_KEY=your_openai_api_key

# Google Translate (선택) - 백업 번역용
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key

# WebSocket 서버 설정 (기본값 사용 가능)
WEBSOCKET_PORT=3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 3. Supabase 데이터베이스 설정

Supabase 대시보드에서 SQL Editor를 열고 다음 스크립트를 실행하세요:

```sql
-- lyrics 테이블 생성
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

-- translations 테이블 생성 (캐싱용)
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

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_lyrics_title_artist ON lyrics(title, artist);
CREATE INDEX idx_translations_lyrics_id ON translations(lyrics_id);
CREATE INDEX idx_translations_unique ON translations(lyrics_id, line_index, target_language);
```

#### 4. 서버 실행

```bash
# 모든 서버 동시 실행 (추천)
npm run dev:all

# 또는 개별 실행
npm run dev          # Next.js 개발 서버 (http://localhost:3000)
npm run ws:server    # WebSocket 서버 (ws://localhost:3001)
```

## 📚 상세 사용법

### 🎮 Step 1: 컨트롤 패널에서 가사 검색

1. 브라우저에서 `http://localhost:3000/control` 접속
2. **검색 및 선택** 탭에서 노래 검색:
   - 노래 제목과 아티스트 입력 (예: "Shape of You Ed Sheeran")
   - YouTube URL 직접 입력 가능
   - Spotify URL 지원
3. 검색 결과에서 원하는 가사 선택
4. **"가사 가져오기 및 불러오기"** 버튼 클릭

### 🎨 Step 2: 오버레이 설정 조정

**오버레이 설정** 탭에서 다음 항목 커스터마이즈:

| 설정 | 설명 | 추천값 |
|------|------|--------|
| **번역 언어** | 가사를 번역할 대상 언어 | 한국어 (ko) |
| **글자 크기** | 화면에 표시될 글자 크기 | 32-48px |
| **하이라이트 색상** | 현재 부르는 부분 색상 | #FFD700 (황금색) |
| **애니메이션 타입** | 가사 전환 효과 | Glow (추천) |
| **자동 재생** | 오버레이 로드 시 자동 시작 | ON |
| **재생 속도** | 가사 재생 속도 조절 | 1.0x |

### 🎬 Step 3: OBS에 오버레이 추가

#### OBS 브라우저 소스 추가

1. OBS Studio 실행
2. **소스** 패널에서 **+** 클릭 → **브라우저** 선택
3. 이름 입력 (예: "가사 오버레이")
4. 다음 설정 입력:

```
URL: http://localhost:3000/obs
너비: 1920
높이: 1080
FPS: 60
사용자 정의 CSS: (비워두기)
```

5. 다음 옵션 체크:
   - ✅ 소스가 보이지 않을 때 종료
   - ✅ 장면이 활성화될 때 브라우저 새로고침
   - ✅ OBS와 상호작용

#### 크로마키 필터 적용

1. 추가한 브라우저 소스 우클릭 → **필터**
2. **효과 필터** 탭에서 **+** 클릭 → **크로마키** 선택
3. 다음과 같이 설정:

| 설정 | 값 | 설명 |
|------|-----|------|
| **키 색상 타입** | 녹색 | 기본 선택 |
| **유사성** | 420 | 녹색 인식 범위 |
| **부드러움** | 60 | 가장자리 부드러움 |
| **키 색상 유출 감소** | 100 | 색상 번짐 제거 |
| **불투명도** | 100 | 완전 불투명 |
| **대비** | 0 | 기본값 유지 |
| **밝기** | 0 | 기본값 유지 |
| **감마** | 0 | 기본값 유지 |

### 🎵 Step 4: 가사 재생 제어

#### 컨트롤 패널에서 제어

컨트롤 패널(`http://localhost:3000/control`)을 통해 실시간 제어:

- ▶️ **재생/일시정지**: 가사 재생 시작/중지
- 🔄 **리셋**: 처음부터 다시 시작
- ⏩ **앞으로/뒤로**: 5초씩 이동
- 🎚️ **속도 조절**: 0.5x ~ 2.0x

#### 키보드 단축키

| 단축키 | 기능 | 설명 |
|--------|------|------|
| `Space` | 재생/일시정지 | 가사 재생 토글 |
| `R` | 리셋 | 처음으로 돌아가기 |
| `←` / `→` | 5초 뒤/앞 | 타임라인 이동 |
| `↑` / `↓` | 속도 조절 | 재생 속도 증가/감소 |
| `ESC` | 정지 | 재생 정지 |
| `T` | 번역 토글 | 번역 표시/숨기기 |

### ✏️ Step 5: 가사 편집 (선택사항)

**가사 편집** 탭에서 타이밍 조정:

1. 편집하고 싶은 라인의 연필 아이콘 클릭
2. 다음 항목 수정 가능:
   - **가사 텍스트**: 오타 수정 또는 내용 변경
   - **시작 시간**: 슬라이더로 정확한 타이밍 조정
   - **지속 시간**: 라인이 표시되는 시간 조정
3. **저장** 버튼으로 변경사항 적용
4. **전체 저장**으로 모든 수정사항 저장

### 🌐 Step 6: 실시간 동기화 (멀티 디바이스)

여러 기기에서 동시에 가사를 보려면:

#### 호스트 (방 생성자)
1. **실시간 동기화** 탭 열기
2. **"방 생성"** 클릭
3. 생성된 **방 코드** 공유 (예: ABC123)

#### 참가자
1. **실시간 동기화** 탭 열기
2. 받은 방 코드 입력
3. **"방 참여"** 클릭

이제 호스트가 가사를 변경하거나 재생을 제어하면 모든 참가자에게 실시간으로 동기화됩니다!

## 📺 OBS 설정 가이드

### 최적 설정 값

#### 장면 구성 예시

```
[장면: 노래방 방송]
├── [게임 캡처] 또는 [화면 캡처]
├── [웹캠] - 본인 얼굴
├── [가사 오버레이] - 브라우저 소스 (크로마키 적용)
└── [오디오] - 마이크 + 데스크톱 오디오
```

#### 권장 비트레이트

- **1080p 60fps**: 6000-8000 Kbps
- **720p 60fps**: 3500-5000 Kbps
- **1080p 30fps**: 4000-6000 Kbps

### 고급 팁

#### 1. 가사 위치 조정
- OBS에서 브라우저 소스를 드래그하여 원하는 위치로 이동
- Alt + 드래그로 크롭(자르기) 가능
- Ctrl + 드래그로 정확한 위치 조정

#### 2. 여러 언어 동시 표시
- 브라우저 소스를 2개 추가
- 각각 다른 언어 설정 (`&lang=ko`, `&lang=en`)
- 위아래로 배치하여 2개 언어 동시 표시

#### 3. 스타일 커스터마이징
URL 파라미터로 세부 조정:
```
http://localhost:3000/obs?fontSize=48&textColor=%23FFFFFF&highlightColor=%23FF00FF&lang=ko
```

## 🔧 고급 설정

### URL 파라미터 전체 목록

| 파라미터 | 설명 | 예시 | 기본값 |
|---------|------|------|--------|
| `chromaKey` | 크로마키 색상 | `%2300FF00` | `#00FF00` |
| `fontSize` | 글자 크기 (px) | `48` | `60` |
| `textColor` | 기본 텍스트 색상 | `%23FFFFFF` | `#FFFFFF` |
| `highlightColor` | 하이라이트 색상 | `%23FFD700` | `#FFD700` |
| `lang` | 번역 언어 코드 | `ko`, `ja`, `zh` | `en` |
| `showTranslation` | 번역 표시 여부 | `true`, `false` | `true` |
| `showOriginal` | 원본 가사 표시 | `true`, `false` | `true` |
| `animation` | 애니메이션 타입 | `fade`, `slide`, `glow` | `glow` |
| `shadowStrength` | 텍스트 그림자 강도 | `1-10` | `5` |

### 사용 예시

#### 한국어 번역 + 큰 글씨
```
http://localhost:3000/obs?lang=ko&fontSize=72
```

#### 일본어 번역 + 핑크색 하이라이트
```
http://localhost:3000/obs?lang=ja&highlightColor=%23FF69B4
```

#### 번역 없이 원본만 표시
```
http://localhost:3000/obs?showTranslation=false&fontSize=64
```

## 🐛 문제 해결

### ❌ 가사가 표시되지 않음

**증상**: OBS에 아무것도 표시되지 않음

**해결 방법**:
1. 컨트롤 패널에서 가사를 선택했는지 확인
2. 브라우저 콘솔 확인 (F12):
   ```javascript
   localStorage.getItem('current_lrc')  // 가사 데이터 확인
   ```
3. OBS 브라우저 소스 새로고침 (우클릭 → 새로고침)
4. 방화벽이 localhost:3000을 차단하지 않는지 확인

### ❌ 크로마키가 제대로 작동하지 않음

**증상**: 녹색 배경이 투명하게 되지 않음

**해결 방법**:
1. 크로마키 필터 설정 재확인:
   - 키 색상 타입: **녹색** (Green 아님)
   - 유사성: 400-450 사이로 조정
2. 조명 조건 확인 (너무 어둡거나 밝으면 문제 발생)
3. GPU 가속 활성화 확인 (OBS 설정 → 고급)

### ❌ 번역이 되지 않음

**증상**: 원본 가사만 표시되고 번역이 안 됨

**해결 방법**:
1. `.env.local` 파일의 API 키 확인:
   ```env
   OPENAI_API_KEY=sk-...  # 올바른 키인지 확인
   ```
2. OpenAI API 크레딧 잔액 확인
3. 네트워크 연결 상태 확인
4. 브라우저 개발자 도구에서 에러 메시지 확인

### ❌ WebSocket 연결 실패

**증상**: "연결 실패" 메시지

**해결 방법**:
1. WebSocket 서버 실행 확인:
   ```bash
   npm run ws:server
   ```
2. 포트 3001이 사용 중인지 확인:
   ```bash
   netstat -an | grep 3001
   ```
3. Windows 방화벽에서 Node.js 허용

### ❌ 가사 동기화가 맞지 않음

**증상**: 노래와 가사 타이밍이 안 맞음

**해결 방법**:
1. **가사 편집** 탭에서 타이밍 수동 조정
2. 재생 속도를 0.9x 또는 1.1x로 미세 조정
3. 다른 소스의 가사 시도 (Genius → LRClib)

## 📊 성능 최적화 팁

### 시스템 리소스 절약

1. **OBS 설정 최적화**:
   - 하드웨어 인코딩 사용 (NVENC, QuickSync)
   - 프로세스 우선순위: 높음
   - 미리보기 비활성화 (방송 중)

2. **브라우저 소스 최적화**:
   - FPS를 30으로 낮추기 (CPU 사용량 감소)
   - 사용하지 않는 장면의 브라우저 소스 비활성화

3. **가사 캐싱 활용**:
   - 같은 노래를 반복 사용 시 자동으로 캐시에서 로드
   - API 호출 없이 즉시 표시 (< 50ms)

## 🤝 기여하기

버그 리포트, 기능 제안, 코드 기여 모두 환영합니다!

1. 이슈 생성: [GitHub Issues](https://github.com/heonyus/lyrics-translator/issues)
2. Pull Request: Fork → 수정 → PR 생성
3. 번역 추가: `src/domains/translation/languages.ts` 수정

## 📄 라이선스

MIT 라이선스 - 자유롭게 사용, 수정, 배포 가능

## 🙏 감사의 말

- [Supabase](https://supabase.com) - 데이터베이스 및 캐싱
- [OpenAI](https://openai.com) - GPT-4 번역
- [LRClib.net](https://lrclib.net) - LRC 가사 데이터
- [Next.js](https://nextjs.org) - React 프레임워크
- [shadcn/ui](https://ui.shadcn.com) - UI 컴포넌트

---

**🎤 Lyrics Translator** - OBS와 함께 전 세계와 노래하세요!

문의사항이나 도움이 필요하시면 [Issues](https://github.com/heonyus/lyrics-translator/issues)에 남겨주세요.