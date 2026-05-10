# Ads Dashboard — Claude Code 지시 파일

## 이 프로젝트에서 무엇을 만드는가

기존 밀잇 DA 대시보드(`2026-04-20_mileat-da-interactive.html`)에
**Google Ads + Meta Ads AI 감사 패널**을 추가하는 작업.

VS Code + Claude Code + Live Server로 로컬 개발.
완성 후 Cloudflare Workers로 배포 (기존 wrangler.toml 사용).

---

## 파일 구조

```
claude-gtm-plugin-main/
├── ads/
│   ├── CLAUDE.md              ← 이 파일 (AI 지시)
│   └── google-meta-rules.md   ← 분석 판단 기준 (반드시 참조)
├── proxy.js                   ← 로컬 Anthropic API 프록시
├── .env                       ← API 키 (절대 커밋 금지)
├── .env.example               ← 키 템플릿
└── 2026-04-20_mileat-da-interactive.html  ← 메인 대시보드
```

---

## 개발 규칙

### 대시보드 HTML 수정 시
- 기존 CSS 변수(`--accent`, `--card`, `--border` 등) 그대로 사용
- Chart.js 4.4.1 이미 로드됨 — 추가 라이브러리 금지
- 새 패널은 항상 `<div class="data-panel">` 구조 따르기
- 한국어 UI 유지

### AI 분석 패널 구현 시
- 분석 요청: `POST http://localhost:3001/analyze`
- 응답 형식: `ads/google-meta-rules.md` 섹션 4의 JSON 구조 그대로
- 로딩 중 스켈레톤 UI 표시 (fetch 중 버튼 비활성화)
- 에러 시 사용자 친화적 한국어 메시지

### proxy.js 수정 시
- `.env`에서 `ANTHROPIC_API_KEY` 읽기
- CORS 헤더 필수 (`Access-Control-Allow-Origin: *`)
- 모델: `claude-sonnet-4-6` 고정
- system prompt에 `ads/google-meta-rules.md` 내용 포함

### 절대 하지 말 것
- `.env` 파일 커밋
- API 키를 HTML/JS에 하드코딩
- 기존 KPI 카드/차트 구조 변경
- `skills/` 폴더 내 파일 수정 (GTM 스킬과 분리 유지)

---

## 작업 우선순위

1. `proxy.js` — Anthropic API 프록시 서버
2. 대시보드에 **Google Ads 분석 패널** 추가 (데이터 입력 → 분석 → 결과 표시)
3. 대시보드에 **Meta Ads 분석 패널** 추가
4. 두 플랫폼 **헬스 스코어 카드** (상단 KPI 영역)
5. **Quick Wins 목록** 패널

---

## 분석 흐름

```
사용자가 광고 데이터 입력 (텍스트/수치)
        ↓
[분석 시작] 버튼 클릭
        ↓
POST /analyze → proxy.js → Claude API
        ↓
JSON 응답 파싱
        ↓
헬스 스코어 + 등급 + 이슈 목록 + Quick Wins 렌더링
```

---

## 판단 기준 참조

분석 로직 작업 시 반드시 `ads/google-meta-rules.md` 먼저 읽을 것.
- 섹션 1: Google Ads 체크 항목 + 임계값
- 섹션 2: Meta Ads 체크 항목 + 임계값
- 섹션 3: 등급 기준
- 섹션 4: 응답 JSON 형식 (파싱 구조 변경 금지)
- 섹션 5: Quick Win 판단 로직
