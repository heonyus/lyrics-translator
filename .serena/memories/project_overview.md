# Lyrics Translator 프로젝트 개요

## 프로젝트 목적
노래방 스타일의 실시간 가사 표시 및 번역 애플리케이션으로, 라이브 스트리밍 중 국제 시청자와 소통할 수 있도록 설계되었습니다.

## 주요 기능
- 자동 가사 가져오기 (Spotify, Genius, YouTube, LRClib)
- 단어별 노래방 스타일 하이라이팅
- Google Translate API를 통한 실시간 번역 (20개 이상 언어 지원)
- OBS 스트리밍 통합 (투명 오버레이)
- AI 기반 가사 매칭 및 신뢰도 점수
- 커스터마이징 가능한 디스플레이 (색상, 폰트, 애니메이션)

## 프로젝트 구조
- `/src/app/` - Next.js App Router 페이지
  - `/demo` - 데모 페이지
  - `/control` - 컨트롤 패널
  - `/overlay` - OBS 오버레이
- `/src/domains/` - DDD 기반 도메인 모듈
  - `/lyrics` - LRC 파싱 및 재생
  - `/lrc-fetcher` - 자동 가사 가져오기
  - `/translation` - 번역 서비스
  - `/karaoke` - 디스플레이 컴포넌트
  - `/metadata` - 메타데이터 추출
  - `/overlay` - 오버레이 관련 기능
  - `/settings` - 설정 관리
  - `/sync` - 동기화 기능
  - `/ui` - UI 관련 도메인
- `/src/components/` - 공유 UI 컴포넌트

## URL 파라미터 (오버레이)
- `q` - 노래 검색 쿼리 또는 URL (필수)
- `lang` - 번역 대상 언어 (기본값: en)
- `fontSize` - 폰트 크기 (픽셀)
- `color` - 하이라이트 색상 (hex)
- `animation` - 애니메이션 타입 (fade, slide, glow)
- `autoPlay` - 자동 재생 여부