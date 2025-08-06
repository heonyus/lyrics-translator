# 🚀 배포 가이드 (Deployment Guide)

## 📋 목차
1. [사전 준비](#1-사전-준비)
2. [Git 설정 및 푸시](#2-git-설정-및-푸시)
3. [Vercel 배포](#3-vercel-배포)
4. [Supabase 설정](#4-supabase-설정)
5. [WebSocket 서버 배포](#5-websocket-서버-배포)
6. [프로덕션 체크리스트](#6-프로덕션-체크리스트)

## 1. 사전 준비

### 필요한 계정
- [ ] GitHub 계정
- [ ] Vercel 계정 (GitHub 연동)
- [ ] Supabase 계정
- [ ] OpenAI API 계정
- [ ] Google Cloud Platform 계정 (선택)
- [ ] Railway/Render/Fly.io 계정 (WebSocket용)

### API 키 준비
```bash
# .env.production 파일 생성
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_key
```

## 2. Git 설정 및 푸시

### Step 1: Git 초기 설정
```bash
# Git 초기화 (이미 완료된 경우 스킵)
git init

# GitHub 저장소 연결
git remote add origin https://github.com/heonyus/lyrics-translator.git
```

### Step 2: 커밋 및 푸시
```bash
# 상태 확인
git status

# 모든 변경사항 추가
git add -A

# 커밋 (의미있는 메시지 작성)
git commit -m "🚀 Production deployment configuration

- Add Vercel deployment settings
- Configure environment variables
- Add backend architecture documentation
- Ready for production deployment"

# GitHub에 푸시
git push -u origin main
```

### Step 3: GitHub 저장소 설정
1. GitHub에서 Settings → Secrets and variables → Actions
2. 다음 시크릿 추가:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

## 3. Vercel 배포

### 방법 1: Vercel 대시보드 (권장)

#### Step 1: 프로젝트 Import
1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. "Add New..." → "Project" 클릭
3. GitHub 저장소 선택 (lyrics-translator)
4. "Import" 클릭

#### Step 2: 프로젝트 설정
```yaml
Framework Preset: Next.js
Root Directory: ./
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

#### Step 3: 환경 변수 설정
Vercel 대시보드에서 각 환경 변수 추가:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | Production |
| `OPENAI_API_KEY` | `sk-...` | Production |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | `AIza...` | All |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Production |

#### Step 4: 배포
"Deploy" 버튼 클릭 → 자동 빌드 및 배포

### 방법 2: Vercel CLI

#### Step 1: CLI 설치
```bash
npm i -g vercel
```

#### Step 2: 로그인 및 프로젝트 연결
```bash
# 로그인
vercel login

# 프로젝트 연결
vercel link

# 환경 변수 설정
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add OPENAI_API_KEY production
```

#### Step 3: 배포
```bash
# 프로덕션 배포
vercel --prod

# 프리뷰 배포 (테스트용)
vercel
```

## 4. Supabase 설정

### Step 1: 프로젝트 생성
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - Name: `lyrics-translator`
   - Database Password: 강력한 비밀번호 생성
   - Region: `Seoul (ap-northeast-2)`
   - Plan: Free (시작용) 또는 Pro

### Step 2: 데이터베이스 스키마 생성
SQL Editor에서 다음 스크립트 실행:

```sql
-- 1. lyrics 테이블 생성
CREATE TABLE IF NOT EXISTS public.lyrics (
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

-- 2. translations 테이블 생성
CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lyrics_id UUID REFERENCES public.lyrics(id) ON DELETE CASCADE,
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

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_lyrics_title_artist 
  ON public.lyrics(title, artist);
CREATE INDEX IF NOT EXISTS idx_lyrics_created_at 
  ON public.lyrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translations_lyrics_id 
  ON public.translations(lyrics_id);
CREATE INDEX IF NOT EXISTS idx_translations_unique 
  ON public.translations(lyrics_id, line_index, target_language);

-- 4. RLS (Row Level Security) 활성화
ALTER TABLE public.lyrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 생성
-- 모든 사용자 읽기 허용
CREATE POLICY "Enable read access for all users" 
  ON public.lyrics FOR SELECT 
  USING (true);

CREATE POLICY "Enable read access for all users" 
  ON public.translations FOR SELECT 
  USING (true);

-- 인증된 사용자만 쓰기 허용 (선택사항)
CREATE POLICY "Enable insert for authenticated users" 
  ON public.lyrics FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users" 
  ON public.translations FOR INSERT 
  WITH CHECK (true);
```

### Step 3: API 키 확인
1. Settings → API
2. 다음 키 복사:
   - `URL`: Supabase 프로젝트 URL
   - `anon public`: 클라이언트용 키
   - `service_role secret`: 서버용 키 (비공개)

## 5. WebSocket 서버 배포

### 옵션 A: Railway 배포 (권장)

#### Step 1: Railway 설정
```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login
```

#### Step 2: 프로젝트 생성
```bash
# 프로젝트 초기화
railway init

# 서비스 추가
railway add

# 환경 변수 설정
railway variables set WEBSOCKET_PORT=3001
railway variables set NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

#### Step 3: 배포
```bash
# package.json에 start 스크립트 추가
{
  "scripts": {
    "start:ws": "node server/websocket-server.js"
  }
}

# 배포
railway up
```

### 옵션 B: Render 배포

1. [Render Dashboard](https://dashboard.render.com) 접속
2. New → Web Service
3. GitHub 저장소 연결
4. 설정:
   - Name: `lyrics-translator-ws`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node server/websocket-server.js`
5. 환경 변수 추가
6. Deploy

### 옵션 C: Fly.io 배포

#### Step 1: Fly.io 설정
```bash
# Fly CLI 설치
curl -L https://fly.io/install.sh | sh

# 로그인
fly auth login
```

#### Step 2: 앱 생성
```bash
# fly.toml 생성
fly launch --name lyrics-translator-ws

# 환경 변수 설정
fly secrets set WEBSOCKET_PORT=3001
fly secrets set NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

#### Step 3: 배포
```bash
fly deploy
```

## 6. 프로덕션 체크리스트

### 배포 전 확인사항

#### 코드 품질
- [ ] TypeScript 에러 없음 (`npm run type-check`)
- [ ] ESLint 경고 없음 (`npm run lint`)
- [ ] 빌드 성공 (`npm run build`)
- [ ] 테스트 통과 (`npm test`)

#### 환경 변수
- [ ] 모든 필수 환경 변수 설정
- [ ] 프로덕션 URL 업데이트
- [ ] API 키 유효성 확인
- [ ] CORS 설정 확인

#### 데이터베이스
- [ ] Supabase 테이블 생성 완료
- [ ] 인덱스 생성 완료
- [ ] RLS 정책 설정 완료
- [ ] 백업 설정

#### 보안
- [ ] 민감한 정보 제거 (console.log 등)
- [ ] API Rate Limiting 설정
- [ ] HTTPS 강제
- [ ] CSP 헤더 설정

### 배포 후 확인사항

#### 기능 테스트
- [ ] 메인 페이지 로드
- [ ] 가사 검색 기능
- [ ] 번역 기능
- [ ] OBS 오버레이
- [ ] WebSocket 연결
- [ ] 키보드 단축키

#### 성능 모니터링
- [ ] Vercel Analytics 확인
- [ ] 페이지 로드 속도
- [ ] API 응답 시간
- [ ] 에러 로그 확인

#### 사용자 경험
- [ ] 모바일 반응형 확인
- [ ] 크로스 브라우저 테스트
- [ ] 다국어 지원 확인

## 🔄 지속적 배포 (CD)

### GitHub Actions 자동 배포
`.github/workflows/deploy.yml` 파일 생성:

```yaml
name: Production Deployment

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Type check
        run: npm run type-check
        
      - name: Lint
        run: npm run lint
        
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## 🔄 롤백 절차

### Vercel에서 롤백
1. Vercel Dashboard → Deployments
2. 이전 성공 배포 선택
3. "..." 메뉴 → "Promote to Production"

### 데이터베이스 롤백
```sql
-- 백업에서 복원
pg_restore -d lyrics_translator backup.sql

-- 또는 Supabase Dashboard에서
-- Settings → Backups → Restore
```

## 📊 모니터링

### Vercel Analytics
```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### 커스텀 도메인 설정
1. Vercel Dashboard → Settings → Domains
2. 도메인 추가 (예: lyrics-translator.com)
3. DNS 설정:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

## 🆘 트러블슈팅

### 빌드 실패
```bash
# 로컬에서 빌드 테스트
npm run build

# 캐시 삭제 후 재시도
rm -rf .next node_modules
npm install
npm run build
```

### 환경 변수 문제
```bash
# Vercel CLI로 확인
vercel env ls

# 환경 변수 다시 설정
vercel env rm VARIABLE_NAME
vercel env add VARIABLE_NAME
```

### WebSocket 연결 실패
- CORS 설정 확인
- WebSocket URL 확인
- 방화벽/프록시 설정 확인

---

📌 **중요**: 프로덕션 배포 전 반드시 모든 체크리스트를 확인하세요!

🎉 배포가 완료되면 다음 URL에서 확인할 수 있습니다:
- Main App: `https://lyrics-translator.vercel.app`
- OBS Overlay: `https://lyrics-translator.vercel.app/obs`
- Control Panel: `https://lyrics-translator.vercel.app/control`