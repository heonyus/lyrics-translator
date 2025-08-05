# 노래방 가사 번역기 프로젝트 문서

## 프로젝트 개요

노래방 스타일의 가사 번역기로, 라이브 스트리밍 중 외국인 시청자를 위해 실시간으로 가사를 표시하고 번역하는 애플리케이션입니다.

### 주요 기능
- 🎤 노래방 스타일 가사 표시 (단어별 하이라이팅)
- 🌍 실시간 가사 번역 (Google Translate API)
- 📺 OBS 브라우저 소스 호환 (투명 배경 오버레이)
- 🎵 자동 LRC 파일 가져오기 (여러 소스에서)
- 🇰🇷 완전한 한국어 UI

## 기술 스택

### 프론트엔드
- **Next.js 15** (App Router)
- **React 19** 
- **TypeScript 5**
- **Tailwind CSS** (스타일링)
- **Framer Motion** (애니메이션)
- **shadcn/ui** (UI 컴포넌트)

### 백엔드/API
- **Google Translate API** (번역)
- **자동 가사 가져오기 프로바이더**:
  - Spotify (현재 CORS 문제로 비활성화)
  - Genius
  - YouTube
  - LRClib

### 아키텍처
- **Domain-Driven Design (DDD)**
- **Zod** (스키마 검증)
- **번역 캐싱 시스템**

## 프로젝트 구조

```
/src
├── app/                    # Next.js App Router 페이지
│   ├── page.tsx           # 메인 랜딩 페이지
│   ├── demo/page.tsx      # 데모 페이지
│   ├── control/page.tsx   # 컨트롤 패널
│   ├── overlay/           # OBS 오버레이
│   │   ├── page.tsx       # 오버레이 디스플레이
│   │   └── help/page.tsx  # OBS 설정 가이드
│   └── layout.tsx         # 루트 레이아웃
│
├── domains/               # DDD 도메인 모듈
│   ├── karaoke/          # 노래방 기능
│   │   ├── components/   # KaraokeDisplay, KaraokeControls
│   │   ├── hooks/        # useKaraokePlayback
│   │   └── services/     # KaraokeService
│   │
│   ├── lyrics/           # 가사 처리
│   │   ├── schemas/      # Zod 스키마
│   │   ├── services/     # LRC 파서, 파일 리더
│   │   └── types/        # TypeScript 타입
│   │
│   ├── lrc-fetcher/      # 자동 가사 가져오기
│   │   ├── core/         # 추상 클래스, 관리자
│   │   ├── providers/    # 각 소스별 프로바이더
│   │   └── types/        # 공통 타입
│   │
│   └── translation/      # 번역 기능
│       ├── services/     # Google Translate, 캐시
│       └── types/        # 번역 타입
│
├── components/           # 공용 UI 컴포넌트
│   └── ui/              # shadcn/ui 컴포넌트
│
└── lib/                 # 유틸리티 함수

```

## 주요 기능 상세

### 1. LRC 파일 형식 지원

단어 수준 타이밍을 지원하는 향상된 LRC 형식:
```
[00:12.00]<00:12.20>When <00:12.50>I <00:12.80>was <00:13.10>young
```

### 2. 자동 가사 가져오기 파이프라인

1. 사용자가 노래 검색 (제목, 아티스트, URL)
2. 여러 프로바이더에서 병렬로 가사 검색
3. 신뢰도 기반 점수 계산
4. 최적의 가사 자동 선택
5. 캐싱으로 성능 최적화

### 3. 실시간 번역

- Google Translate API 통합
- 줄 단위 번역
- 캐싱으로 API 호출 최소화
- 다국어 지원

### 4. OBS 통합

- 투명 배경 오버레이
- URL 파라미터로 커스터마이징
- 실시간 업데이트 (WebSocket 예정)

## 현재 상태 및 이슈

### 완료된 작업
- ✅ 기본 프로젝트 구조 설정
- ✅ 도메인 모듈 구현
- ✅ LRC 파서 및 디스플레이
- ✅ 자동 가사 가져오기 (3개 프로바이더)
- ✅ Google Translate 통합
- ✅ OBS 오버레이 기능
- ✅ 전체 UI 한국어 번역

### 현재 이슈
1. **모듈 해결 오류** (./730.js)
   - Next.js 웹팩 청킹 문제
   - 데모 페이지 접근 시 발생

2. **Spotify 프로바이더 비활성화**
   - CORS 정책으로 인한 문제
   - 서버사이드 API 라우트 필요

3. **프로덕션 준비 미완성**
   - 데이터베이스 통합 필요
   - 사용자 인증 시스템 필요
   - 실제 배포 설정 필요

## 설치 및 실행

### 필수 요구사항
- Node.js 20.0.0 이상
- npm 또는 yarn
- Google Cloud API 키 (번역용)

### 환경 변수 설정
`.env.local` 파일 생성:
```env
NEXT_PUBLIC_GOOGLE_API_KEY=your-google-api-key
```

### 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm run dev
```

### 빌드
```bash
npm run build
```

## 사용 방법

### 1. 메인 페이지
- 홈페이지에서 "데모 체험" 또는 "컨트롤 패널" 선택

### 2. 컨트롤 패널
- 노래 검색 (제목, 아티스트, URL)
- 가사 소스 선택
- 번역 언어 설정
- OBS URL 복사

### 3. OBS 설정
1. OBS에서 브라우저 소스 추가
2. 오버레이 URL 입력
3. 너비: 1920, 높이: 1080 설정
4. "페이지와 상호작용" 체크 해제

## 향후 계획

### 단기 목표
- [ ] 모듈 해결 오류 수정
- [ ] Spotify 프로바이더 서버사이드 구현
- [ ] WebSocket 실시간 동기화
- [ ] 더 많은 가사 소스 추가

### 장기 목표
- [ ] 데이터베이스 통합 (Supabase)
- [ ] 사용자 계정 시스템
- [ ] 가사 편집 기능
- [ ] 커스텀 스타일 테마
- [ ] 모바일 앱 개발

## API 엔드포인트 (예정)

```
GET  /api/lyrics/search     # 가사 검색
GET  /api/lyrics/:id        # 특정 가사 가져오기
POST /api/lyrics            # 가사 저장
GET  /api/translate         # 텍스트 번역
```

## 기여 가이드라인

1. 모든 UI 텍스트는 한국어로 작성
2. 타입스크립트 strict 모드 준수
3. Zod 스키마로 데이터 검증
4. 도메인별로 코드 구성
5. 의미 있는 커밋 메시지 작성

## 라이선스

이 프로젝트는 MIT 라이선스로 배포됩니다.

## 문의사항

프로젝트 관련 문의사항이 있으시면 이슈를 생성해주세요.

---

🎤 노래방 가사 번역기 - 전 세계와 함께 노래하세요!