# SideTown

사이드 프로젝트(출판·앱 개발·자격증…)를 퀘스트로 나누고, 실제로 끝낼 때마다 복셀 마을의 건물과 캐릭터가 자라는 웹앱.

> 지금 저장소는 **단계 1**이에요: Supabase 로그인·DB·보상 원장·친구 마을·AI 계획 초안.
> Supabase 키가 없으면 로그인 없이 **데모 마을**(예시 데이터, 이 브라우저에만 저장)로 실행돼요.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 일정 계산·경로 탐색·타이머·AI 초안 + DB 규칙(실제 Postgres, PGlite)
npm run typecheck
npm run build
```

Node.js 20.9 이상이 필요해요.

## 서버 연결 (Supabase · Google 로그인 · Gemini)

키는 저장소나 대화에 붙여 넣지 말고 `.env.local`(로컬)과 Vercel 환경 변수에만 넣어 주세요.

1. **Supabase 프로젝트 만들기** — [supabase.com](https://supabase.com)에서 새 프로젝트(지역: Seoul 권장).
2. **DB 만들기** — SQL Editor에 `supabase/migrations/20261027000000_init.sql` 전체를 붙여 넣고 실행. (Supabase CLI를 쓰면 `supabase link` 후 `supabase db push`)
3. **로그인 주소 등록** — Authentication → URL Configuration
   - Site URL: 배포 주소(예: `https://sidetown.vercel.app`)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<배포 주소>/auth/callback`
4. **Google 로그인(선택)** — Google Cloud Console에서 OAuth 클라이언트(웹)를 만들고, 승인된 리디렉션 URI에 `https://<프로젝트>.supabase.co/auth/v1/callback`을 넣은 뒤, Supabase → Authentication → Providers → Google에 클라이언트 ID·보안 비밀 입력. 이메일 링크 로그인은 따로 설정하지 않아도 돼요.
5. **환경 변수** — `.env.example`을 `.env.local`로 복사해 채우기
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys의 publishable 키. secret/service_role 키는 넣지 마세요)
   - `GEMINI_API_KEY` (Google AI Studio). 없으면 AI 초안 대신 기본 템플릿
6. **배포** — Vercel에서 이 저장소를 가져오고 같은 환경 변수를 넣으면 끝.

처음 로그인하면 닉네임·마을 이름을 정하고, 카페 패널의 **초대 링크 만들기**로 친구(최대 8명)를 부를 수 있어요.

### 데이터 규칙 (기획서 16~18절)

- 표에 직접 쓸 수 없어요. 모든 쓰기는 `security definer` 함수(RPC)로만 하고, 함수가 권한·정원·보상 규칙을 검사해요.
- 같은 마을 친구는 프로젝트의 **겉모습**(이름·건물·단계·상태·목표일)만 봐요. 중간 목표·퀘스트·성과 기록은 본인만.
- XP는 `reward_ledger`에 쌓기만 하고, 완료 취소는 반대 사건(−10)으로 역산해요. 같은 요청을 두 번 보내도(Idempotency key) 한 번만 지급.
- 마을 정원 8명은 동시 수락에서도 넘지 않도록 마을 행을 잠그고 셉니다.
- 쪽지는 1분 5회·하루 100회, 200자. 받는 사람의 프로젝트에만 응원을 붙일 수 있어요.
- AI 초안은 하루 20회(`ai_usage`). 응답은 zod 스키마를 통과한 것만 쓰고, 날짜는 앱이 계산해요.
- `supabase/tests/db.test.ts`가 이 규칙들을 실제 Postgres(PGlite)에서 확인해요.

## 지금 검증할 수 있는 것 (단계 0 + v1.2 보강)

| 기획서 | 확인 방법 |
| --- | --- |
| 7. 마을·이동 | 바닥을 누르면 A* 경로로 캐릭터가 걸어가요. 드래그로 이동, 휠·＋/− 로 확대 |
| 6.2 프로젝트 패널 | 건물을 누르면 패널이 열리고 카메라가 건물을 패널 왼쪽 가운데로 옮겨요 |
| 6.7 항해 진척도 | 배=실제, 부표=계획 위치, 깃발=목표일, 물결 높이=순항·주의·지연 |
| 8.2 미루기 | 패널 ‘일정’ 탭: 뒤 일정까지 1주 / 다음 퀘스트만 1주 / 항해 쉬기 |
| 8.3 지연 30일 | 정보처리기사(연구소)는 57일 지연으로 낡은 상태. ‘15분짜리 퀘스트로 불 켜기’ → 수리 중 → 퀘스트 완료 → 복구 |
| 11 성장 4단계 | 퀘스트를 모두 끝내고 성과 메모를 남기면 중간 목표 완료 → 단계 변화 시 성장 연출 |
| 6.3 모바일 | 1024px 미만에서는 패널이 하단 시트 |
| 6.4 대체 화면 | ‘목록으로 보기’ — WebGL을 쓸 수 없으면 자동으로 목록 |
| 6.6 집중 모드 | `/focus` — 25/5/15 뽀모도로, 움직이는 장면 3종(사람·커피·고양이·새·바람이 있는 10초 루프 영상 + 바람·돌풍·비·눈·낙엽·새 떼·반딧불 실시간 층), Web Audio 합성 BGM·환경음 믹서 |
| 13.5 쪽지·게시판 | 상단 친구 얼굴·쪽지함, 마을의 친구 캐릭터, 카페 게시판, 프로젝트 패널 ‘친구 응원’ |
| 6.8 카페·집·착공 | 카페·집은 처음부터 열림. 빈 부지나 ‘+ 새 프로젝트’로 바로 착공(공사 부지로 시작) |

데모 마을에서는 오른쪽 위 **검증 도구**로 날짜를 +7일·+30일 옮겨 지연 판정을 시험할 수 있어요(로그인한 마을에는 없음).

## 구조

```
src/
  app/                 Next.js App Router (/, /focus, /login, /onboarding, /invite/[token], /api/plans/draft)
  proxy.ts             요청마다 Supabase 세션 갱신(Next 16의 middleware)
  lib/supabase/        브라우저·서버 클라이언트, 로그인·마을 소속 확인
  lib/live.ts          서버 모드 읽기(RLS)·쓰기(RPC), DB 행 ↔ 앱 타입
  lib/plan-draft.ts    AI 계획 초안 스키마·프롬프트·대체 템플릿
  components/LiveSync  실시간(쪽지·건물 변화)·Presence(접속·집중 중)
  components/          TownApp, ProjectPanel, Voyage, FocusScreen …
  lib/schedule.ts      진척도·상태·누적 지연·건물 상태·미루기(8.1~8.3) — 순수 함수 + 테스트
  lib/sample-data.ts   예시 프로젝트 3개
  store/useApp.ts      zustand 스토어 — 데모(브라우저 저장) / 서버(낙관적 갱신 후 RPC, 실패 시 되돌림)
  town/                PixiJS 렌더러, 아이소메트릭 변환, A*, 맵 정의
  focus/               뽀모도로 타이머(끝나는 시각 기준), Web Audio 엔진, 장면·바람
  lib/social.ts        쪽지·게시판 도우미(서버 모드는 messages 표)
supabase/
  migrations/          표·RLS·RPC
  tests/               PGlite로 RLS·보상·정원·쪽지 규칙 테스트
  lib/templates.ts     새 프로젝트 템플릿·착공
public/assets/         Higgsfield로 만든 건물·소품·캐릭터 스프라이트, 집중 모드 장면
```

## 에셋

건물(공방·서점·연구소 각 4단계: 공사 부지 → 방 한 칸 → 2층 → 랜드마크, 공방 낡음·수리 중), 카페·집, 나무·가로등·벤치·화단, 캐릭터 4방향, 집중 모드 장면(저녁·비·눈)은 Higgsfield GPT Image 2.5로 생성한 뒤 여백을 자르고 팔레트 PNG로 줄였어요. 단계 0 기준값이라 런타임용 텍스처 아틀라스·정밀 기준점은 단계 3에서 정리합니다.

- 집중 모드 영상은 Higgsfield Kling 3.0으로 만든 10초 루프(0.5~1MB)이고 지금은 Higgsfield CDN 주소를 쓴다(`src/focus/scenes.ts`). 못 불러오면 정지 이미지로 대체돼요. 단계 1에서 서비스 저장소로 옮겨요.
- 연구소·서점의 낡음 상태는 전용 그림 대신 ‘채도 낮춤 + 어둡게 + 비구름’ 오버레이로 표현해요(기획서 11절 상태 레이어 검증).
- 스프라이트 기준점은 바닥 마름모 아래 꼭짓점 기준의 근사값이에요. 겹침이 어색한 조합은 `src/town/TownRenderer.ts`의 `placeSprite`에서 조정합니다.

## 다음 단계

- 단계 1.5: 주간 캘린더·타임라인·미루기 창·주간 회고
- 알려진 한계
  - 프로젝트 부지는 5칸. 마을이 커지면(8명) 확장 구역이 필요해요(단계 2)
  - Presence 채널은 마을 id를 아는 사람이면 들어올 수 있는 공개 채널이에요. 접속·집중 상태만 오가고 내용은 없지만, 단계 2에서 Realtime 권한(비공개 채널)으로 좁혀요
  - 집중 모드 영상은 아직 Higgsfield CDN 주소
  - 핀치 줌 없음(버튼·휠만), 캐릭터 걷기 프레임 없음, 이름표는 Pixi 텍스트

디자인 기준은 디자인 캔버스 ‘SideTown UI 초안’, 요구사항은 `docs/SideTown_Detailed_Product_Plan.md`(v1.2).
