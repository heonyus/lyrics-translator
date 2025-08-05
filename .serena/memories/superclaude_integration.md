# SuperClaude Framework 통합

## 설치 위치
- SuperClaude Framework: `/lib/SuperClaude_Framework/`
- Awesome Claude Code: `/lib/awesome-claude-code/`
- 슬래시 커맨드: `.claude/commands/`

## 주요 기능

### SuperClaude Framework
- **명령 시스템**: `/analyze`, `/build`, `/implement`, `/improve` 등
- **페르소나 시스템**: 11개 전문 페르소나 (architect, frontend, backend, security, qa 등)
- **MCP 서버 통합**: Context7, Sequential, Magic, Playwright
- **Wave 오케스트레이션**: 복잡한 작업을 위한 다단계 실행
- **토큰 최적화**: `--uc` 플래그로 30-50% 토큰 절감

### 통합된 슬래시 커맨드
- `/commit` - Git 커밋 자동화
- `/todo` - 작업 목록 관리
- `/clean` - 코드 정리 및 최적화
- `/create-pr` - Pull Request 생성
- `/testing_plan_integration` - 테스트 계획 통합

## 프로젝트별 활용

### 가사 번역기 프로젝트
- **분석**: `/analyze --persona-frontend` - UI 컴포넌트 분석
- **성능**: `/improve --perf --persona-performance` - 실시간 번역 최적화
- **문서화**: `/document --persona-scribe=ko` - 한국어 문서 작성
- **테스트**: `/test --playwright` - OBS 통합 테스트

### 권장 워크플로우
1. 코드 분석: `/analyze --think`
2. 개선 계획: `/improve --plan`
3. 구현: `/implement --validate`
4. 테스트: `/test e2e`
5. 문서화: `/document --persona-scribe=ko`