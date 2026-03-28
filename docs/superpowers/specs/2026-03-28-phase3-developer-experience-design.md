# Phase 3: 개발자 경험 설계

> `neuron dev` 명령으로 파일 감시 + 라이브 리로드 개발 서버를 제공하고,
> 빌드 시 자동 검증으로 .neuron 파일의 문제를 사전에 잡는다.

## 배경

Phase 1-2에서 DSL 표현력과 런타임 품질을 개선했다. 하지만 개발 루프가 느리다:
- 파일 수정 → 수동 `neuron build` → 수동 브라우저 새로고침
- 존재하지 않는 state/action 참조가 런타임에서야 발견됨

## 설계 원칙

1. **Zero dependency**: WebSocket을 순수 Node.js로 구현. 외부 패키지 추가 없음.
2. **AI 워크플로우 통합**: `neuron dev`로 빌드+서버+감시가 한 번에. AI가 파일 저장하면 즉시 반영.
3. **검증은 빌드에 내장**: 별도 명령 없이 `neuron build`에서 자동 실행.

## 1. `neuron dev` 명령

### CLI

```bash
neuron dev              # dev server 시작 (기본 포트 3000)
neuron dev --port 8080  # 포트 지정
```

### 동작 흐름

1. 초기 빌드 실행 → `dist/` 생성
2. 내장 HTTP 서버 시작 (SPA 라우팅 지원)
3. WebSocket 서버 시작 (같은 포트, `ws://` upgrade on connection)
4. 파일 감시 시작
5. 파일 변경 감지 → debounce 300ms → 리빌드 → WebSocket `reload` 메시지
6. 브라우저가 메시지 받으면 `location.reload()`

### 감시 대상 파일

- `app.neuron`
- `pages/*.neuron`
- `apis/*.neuron`
- `logic/*.js`
- `themes/theme.json`
- `assets/*`

### Dev 모드 클라이언트 주입

빌드 시 dev 모드이면 `index.html`의 `</body>` 앞에 WebSocket 클라이언트 스크립트 주입:

```javascript
(function() {
  var ws = new WebSocket('ws://' + location.host);
  ws.onmessage = function(e) {
    if (e.data === 'reload') location.reload();
  };
  ws.onclose = function() {
    setTimeout(function() { location.reload(); }, 1000);
  };
})();
```

프로덕션 빌드(`neuron build`)에서는 주입하지 않는다.

### HTTP 서버

Node.js `http.createServer` 사용. SPA 라우팅 지원:
- 파일이 존재하면 해당 파일 서빙 (MIME 타입 자동 감지)
- 그 외 모든 경로는 `index.html` 반환

### WebSocket 서버

외부 라이브러리 없이 순수 Node.js로 구현:
- HTTP upgrade 요청 감지
- WebSocket handshake (RFC 6455)
- 텍스트 프레임 전송 (`reload` 메시지만)
- 연결 관리 (Set으로 클라이언트 추적, 연결 해제 시 제거)

구현 범위는 최소한:
- 텍스트 메시지 전송만 (바이너리 불필요)
- ping/pong 불필요 (로컬 개발용)
- 126바이트 미만 메시지만 (reload 문자열)

### 파일 감시

`fs.watch`를 재귀 모드(`{ recursive: true }`)로 프로젝트 디렉토리에 적용.

- 변경 이벤트 발생 시 300ms debounce (연속 저장 대응)
- debounce 후 전체 리빌드 실행
- 빌드 성공 시 WebSocket으로 `reload` 전송
- 빌드 실패 시 에러를 콘솔에 출력, 브라우저에 reload 보내지 않음
- `dist/` 및 `node_modules/` 변경은 무시

### 파일 구조

```typescript
// src/dev-server.ts
export interface DevServerOptions {
  port: number;
  projectDir: string;
}

export function startDevServer(options: DevServerOptions): void
```

내부적으로:
- `createHttpServer()` — HTTP 서버 + 정적 파일 서빙
- `createWebSocketServer(httpServer)` — WS upgrade 처리, 클라이언트 관리
- `watchFiles()` — fs.watch + debounce + rebuild + notify
- `rebuild()` — compile 호출 + dist 쓰기

## 2. 빌드 내장 검증

### 검증 항목

| 검증 | 대상 | 에러 메시지 |
|------|------|------------|
| 미정의 state 참조 | 컴포넌트의 `data:`, `state:`, `show_if:` 속성 | `[NEURON ERROR] state "xxx"가 정의되지 않음` |
| 미정의 action 참조 | `on_click:`, `on_remove:`, inline action, `cta:` action, form submit action | `[NEURON ERROR] action "xxx"가 정의되지 않음` |
| 미정의 API 참조 | ACTION의 `call:` 스텝 | `[NEURON ERROR] API "xxx"가 정의되지 않음` |
| 중복 라우트 | 같은 route를 가진 PAGE 정의 | `[NEURON ERROR] 중복 라우트: "/xxx"` |
| 중복 페이지 이름 | 같은 name을 가진 PAGE 정의 | `[NEURON ERROR] 중복 페이지 이름: "xxx"` |
| persist 필드 미정의 | persist에 선언된 필드가 STATE fields에 없음 | `[NEURON ERROR] persist 필드 "xxx"가 STATE에 정의되지 않음` |

### 검증 로직

내부 state(`_params`, `_loading`, `_error`)는 검증에서 제외한다.

Action 참조 검증 시, 라우트 형태(`/`로 시작)는 action이 아니라 navigation이므로 제외한다.

### 구현

```typescript
// src/validator.ts
import type { NeuronAST } from './ast';

export function validate(ast: NeuronAST): string[] {
  const errors: string[] = [];
  // 각 검증 항목 수행
  return errors;  // 빈 배열이면 검증 통과
}
```

### 컴파일러 통합

`compiler.ts`에서 AST 파싱 완료 후, 코드 생성 전에 `validate()` 호출:

```typescript
  // Validate AST
  const validationErrors = validate(ast);
  errors.push(...validationErrors);
```

검증 에러가 있어도 빌드는 계속 진행한다 (경고 수준). 에러는 `result.errors`에 포함되어 콘솔에 출력된다.

## 3. CLI 업데이트

### 명령어 추가

```
Neuron DSL Compiler

Commands:
  neuron new <name>   Create a new project
  neuron build        Build the current project
  neuron dev          Start dev server with live reload
```

### 인자 파싱

```typescript
if (command === 'dev') {
  let port = 3000;
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1], 10);
  }
  startDevServer({ port, projectDir: resolve(process.cwd()) });
  return;
}
```

### HTML 생성 변경

`generateHTML`에 `devMode` 옵션 추가:

```typescript
export function generateHTML(pages: PageNode[], appTitle: string, devMode?: boolean): string
```

dev 모드일 때 `</body>` 앞에 WebSocket 클라이언트 스크립트를 주입한다.

`compiler.ts`의 `CompileInput`에 `devMode?: boolean` 추가.

## 4. 영향받는 모듈

| 모듈 | 변경 |
|------|------|
| `src/dev-server.ts` | **새 파일**: HTTP + WebSocket + watch + rebuild |
| `src/validator.ts` | **새 파일**: AST 검증 |
| `src/cli.ts` | `dev` 명령 추가, help 메시지 업데이트 |
| `src/compiler.ts` | validate() 호출 추가, `devMode` 옵션 추가 |
| `src/generator/html.ts` | dev 모드 시 WS 클라이언트 주입 |
| `src/errors.ts` | 검증 관련 에러 코드 추가 (duplicate_route, duplicate_page, undefined_persist_field) |

## 5. 테스트 계획

| 테스트 | 검증 내용 |
|--------|----------|
| validator: 미정의 state | data: 에서 없는 state 참조 시 에러 |
| validator: 미정의 action | on_click에서 없는 action 참조 시 에러 |
| validator: 미정의 API | call:에서 없는 API 참조 시 에러 |
| validator: 중복 라우트 | 같은 route 2개 시 에러 |
| validator: 중복 페이지 이름 | 같은 name 2개 시 에러 |
| validator: persist 미정의 필드 | persist에 없는 필드 시 에러 |
| validator: 유효한 AST | 에러 없음 확인 |
| validator: 내부 state 제외 | _params, _loading 참조 시 에러 안 남 |
| html: dev 모드 주입 | devMode=true 시 WebSocket 스크립트 포함 |
| html: prod 모드 미주입 | devMode=false 시 WebSocket 스크립트 미포함 |
| compiler: validate 통합 | 검증 에러가 result.errors에 포함 |
| dev-server: 기본 동작 | startDevServer 함수 존재 및 export 확인 (실제 서버 시작은 통합 테스트 범위) |

dev-server의 HTTP/WebSocket 동작은 단위 테스트가 어려우므로, 함수 export와 기본 구조만 테스트한다. 실제 동작은 수동 검증.

## 6. 범위 밖

- HMR (Hot Module Replacement) → 범위 밖
- 소스맵 → 범위 밖
- `neuron lint` 별도 명령 → 범위 밖
- 빌드 리포트 상세화 → 범위 밖
- HTTPS dev server → 범위 밖
