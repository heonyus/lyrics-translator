# 프로젝트 명령어

## 개발 명령어
```bash
# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start
```

## 코드 품질 관리
```bash
# ESLint 린팅 실행
npm run lint

# Gemini AI 코드 리뷰
npm run gemini:review

# Gemini AI 코드 최적화 제안
npm run gemini:optimize

# Gemini AI 코드 분석
npm run gemini:analyze
```

## Serena 명령어
```bash
# Serena 인덱싱
npm run serena:index

# Serena 검색
npm run serena:search
```

## Git 명령어 (Linux/WSL)
```bash
# 상태 확인
git status

# 변경사항 추가
git add .

# 커밋
git commit -m "메시지"

# 브랜치 확인
git branch

# 새 브랜치 생성 및 체크아웃
git checkout -b feature/branch-name
```

## 시스템 유틸리티 (Linux/WSL)
```bash
# 디렉토리 목록
ls -la

# 디렉토리 이동
cd [path]

# 파일 검색
find . -name "*.tsx"

# 텍스트 검색
grep -r "검색어" .

# 프로세스 확인
ps aux | grep node

# 포트 확인
netstat -tulpn | grep 3000
```

## 환경 설정
```bash
# 환경 변수 파일 복사
cp .env.example .env.local

# .env.local 편집 (Google API 키 추가 필요)
# NEXT_PUBLIC_GOOGLE_API_KEY=your_api_key_here
```

## 페이지 접근
- 메인: http://localhost:3000
- 데모: http://localhost:3000/demo
- 컨트롤 패널: http://localhost:3000/control
- OBS 오버레이: http://localhost:3000/overlay
- OBS 설정 가이드: http://localhost:3000/overlay/help