## Task 0002: 가라오케(Karaoke) 도메인 구현

### 목표

단어별 하이라이팅 엔진, 부드러운 전환 애니메이션, 타이밍 동기화를 담당하는 Karaoke 도메인을 구현합니다. 시각적으로 매력적이고 정확한 가라오케 효과를 제공합니다.

### 작업 상세

- [ ] **타입 정의 및 인터페이스**
  - **타입 정의 (`src/domains/karaoke/types/karaoke.types.ts`)**
    - `KaraokeState`: 현재 재생 상태 (라인, 단어, 진행률)
    - `HighlightStyle`: 하이라이팅 스타일 옵션
    - `AnimationConfig`: 애니메이션 설정
    - `KaraokeDisplay`: 디스플레이 설정 (위치, 크기, 폰트)
  
  - **상수 정의 (`src/domains/karaoke/types/constants.ts`)**
    - 기본 애니메이션 지속 시간
    - 스타일 프리셋
    - 타이밍 오프셋 기본값

- [ ] **렌더링 엔진 구현**
  - **가라오케 렌더러 (`src/domains/karaoke/renderer/karaoke-renderer.tsx`)**
    - 현재 라인 표시 컴포넌트
    - 단어별 하이라이팅 로직
    - 진행률 표시 (프로그레스 바)
    - 다음 라인 미리보기
  
  - **애니메이션 관리자 (`src/domains/karaoke/renderer/animation-manager.ts`)**
    - Framer Motion 기반 애니메이션
    - 단어 전환 효과 (fade, slide, scale)
    - 부드러운 색상 전환
    - 타이밍 기반 애니메이션 큐

- [ ] **동기화 시스템**
  - **동기화 엔진 (`src/domains/karaoke/sync/sync-engine.ts`)**
    - 재생 시간과 가사 동기화
    - 지연 시간 보정
    - 프레임 기반 업데이트 (requestAnimationFrame)
    - 성능 최적화 (React.memo, useMemo)
  
  - **타이밍 조정기 (`src/domains/karaoke/sync/timing-adjuster.ts`)**
    - 수동 오프셋 조정
    - 자동 동기화 감지
    - BPM 기반 동기화 옵션

- [ ] **스타일링 시스템**
  - **스타일 매니저 (`src/domains/karaoke/styles/style-manager.ts`)**
    - 테마 프리셋 관리
    - 커스텀 스타일 적용
    - 폰트 로딩 및 관리
    - 색상 팔레트 시스템
  
  - **이펙트 라이브러리 (`src/domains/karaoke/styles/effects.ts`)**
    - 텍스트 그림자 효과
    - 글로우 효과
    - 그라데이션 하이라이팅
    - 파티클 효과 (선택적)

- [ ] **React Components**
  - **KaraokeDisplay (`src/domains/karaoke/components/karaoke-display.tsx`)**
    - 메인 가라오케 디스플레이 컴포넌트
    - Props: lyrics, currentTime, style, config
    - 반응형 레이아웃
  
  - **WordHighlight (`src/domains/karaoke/components/word-highlight.tsx`)**
    - 개별 단어 하이라이팅 컴포넌트
    - 애니메이션 상태 관리
    - 터치/클릭 이벤트 처리
  
  - **ProgressIndicator (`src/domains/karaoke/components/progress-indicator.tsx`)**
    - 진행률 표시 컴포넌트
    - 시각적 타임라인
    - 드래그로 위치 이동

- [ ] **React Hooks**
  - **useKaraoke Hook (`src/domains/karaoke/hooks/use-karaoke.ts`)**
    - 가라오케 상태 관리
    - 재생/일시정지 제어
    - 동기화 상태 추적
  
  - **useHighlight Hook (`src/domains/karaoke/hooks/use-highlight.ts`)**
    - 현재 하이라이트 상태
    - 애니메이션 트리거
    - 스타일 업데이트

### 완료 조건

- 단어가 정확한 타이밍에 하이라이팅됨
- 부드러운 애니메이션 전환이 구현됨
- 다양한 스타일과 효과를 선택할 수 있음
- 수동으로 타이밍을 조정할 수 있음
- 성능이 최적화되어 프레임 드롭이 없음