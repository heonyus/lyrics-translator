# 코드 스타일 및 컨벤션

## TypeScript 설정
- **Strict 모드 활성화** (`strict: true`)
- ES2017 타겟
- Module resolution: bundler
- JSX: preserve
- Path alias: `@/*` -> `./src/*`

## 프로젝트 구조 패턴
- **Domain-Driven Design (DDD)** 아키텍처
- 도메인별 모듈 구성 (`/src/domains/`)
- 각 도메인은 독립적인 기능 단위
- 컴포넌트, 훅, 서비스, 타입을 도메인별로 그룹화

## 네이밍 컨벤션
- **컴포넌트**: PascalCase (예: `KaraokeDisplay.tsx`)
- **훅**: camelCase with 'use' prefix (예: `useKaraokePlayback`)
- **서비스**: PascalCase with 'Service' suffix (예: `TranslationService`)
- **타입/인터페이스**: PascalCase (예: `KaraokeDisplayProps`)
- **파일**: 컴포넌트는 PascalCase, 유틸리티는 camelCase

## 스타일링
- **Tailwind CSS** 유틸리티 클래스 사용
- **CSS-in-JS 없음** - Tailwind 우선
- **clsx** 및 **tailwind-merge**로 조건부 클래스 처리
- **Framer Motion**으로 애니메이션 처리

## 폼 및 검증
- **React Hook Form**으로 폼 상태 관리
- **Zod**로 스키마 검증
- 타입 안전한 폼 처리

## UI 컴포넌트
- **Radix UI** 기반 접근 가능한 컴포넌트
- **shadcn/ui** 패턴 따르기
- 재사용 가능한 컴포넌트는 `/src/components/ui/`에 위치

## 언어 지원
- 전체 UI는 **한국어**가 기본
- 번역 대상 언어는 20개 이상 지원