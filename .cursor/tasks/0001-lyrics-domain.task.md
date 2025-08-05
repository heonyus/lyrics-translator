## Task 0001: 가사(Lyrics) 도메인 구현

### 목표

LRC 파일 파싱, 단어별 타이밍 처리, 가사 데이터 구조 관리를 담당하는 Lyrics 도메인을 구현합니다. 확장된 LRC 형식을 지원하여 단어 단위의 정밀한 타이밍을 처리할 수 있도록 합니다.

### 작업 상세

- [ ] **타입 정의 및 스키마**
  - **타입 정의 (`src/domains/lyrics/types/lyrics.types.ts`)**
    - `LRCMetadata`: 곡 제목, 아티스트, 앨범 등 메타데이터
    - `WordTiming`: 단어별 시작/종료 시간, 텍스트
    - `LyricLine`: 전체 라인 텍스트, 타임스탬프, 단어 배열
    - `ParsedLRC`: 파싱된 전체 LRC 데이터 구조
  
  - **검증 스키마 (`src/domains/lyrics/schemas/lyrics.schema.ts`)**
    - Zod를 사용한 LRC 데이터 검증
    - 타이밍 유효성 검사
    - 메타데이터 형식 검증

- [ ] **LRC 파서 구현**
  - **파서 클래스 (`src/domains/lyrics/parser/lrc-parser.ts`)**
    - 기본 LRC 형식 파싱 ([mm:ss.xx]가사)
    - 확장 형식 파싱 ([mm:ss.xx]<mm:ss.xx>단어1 <mm:ss.xx>단어2)
    - 메타데이터 태그 파싱 ([ti:], [ar:], [al:] 등)
    - 에러 처리 및 복구 메커니즘
  
  - **파서 유틸리티 (`src/domains/lyrics/parser/parser-utils.ts`)**
    - 타임스탬프 변환 함수
    - 텍스트 정제 함수
    - 인코딩 감지 및 변환

- [ ] **가사 관리 시스템**
  - **가사 매니저 (`src/domains/lyrics/manager/lyrics-manager.ts`)**
    - LRC 파일 로드 및 파싱
    - 가사 데이터 캐싱
    - 현재 재생 위치에 따른 라인/단어 찾기
    - 가사 동기화 상태 관리
  
  - **가사 저장소 (`src/domains/lyrics/storage/lyrics-storage.ts`)**
    - IndexedDB를 사용한 로컬 저장
    - 파일 업로드 처리
    - 가사 목록 관리

- [ ] **React Hooks**
  - **useLyrics Hook (`src/domains/lyrics/hooks/use-lyrics.ts`)**
    - 가사 로드 상태 관리
    - 현재 라인/단어 추적
    - 재생 위치 동기화
  
  - **useLRCParser Hook (`src/domains/lyrics/hooks/use-lrc-parser.ts`)**
    - 파일 파싱 상태 관리
    - 파싱 에러 처리
    - 실시간 미리보기

- [ ] **도메인 내보내기**
  - **인덱스 파일 (`src/domains/lyrics/index.ts`)**
    - 모든 공개 API 내보내기
    - 타입, 스키마, 클래스, 훅 등

### 완료 조건

- LRC 파일을 업로드하면 정확히 파싱됨
- 단어별 타이밍이 올바르게 추출됨
- 재생 시간에 따라 현재 라인과 단어를 정확히 찾을 수 있음
- 파싱 에러가 발생해도 안정적으로 처리됨
- 가사 데이터가 로컬에 저장되고 관리됨