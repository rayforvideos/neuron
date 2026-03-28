# Phase 1: DSL 기능 확장 설계

> Neuron DSL의 표현력을 범용 프레임워크 수준으로 확장한다.
> AI 에이전트가 생성하기 쉬운 구조를 최우선으로 고려한다.

## 배경

Neuron v1.0은 4개 키워드(STATE, ACTION, API, PAGE)로 SPA를 생성하는 컴파일러다. 현재 한계:

- 액션 패턴 3종(append, remove, call)만 지원
- 정적 라우팅만 가능 (`/product/:id` 불가)
- 조건부 렌더링 불가
- 폼 검증 없음
- 복잡한 비즈니스 로직을 DSL로 표현할 수 없음

## 설계 원칙

1. **키워드 4개 유지**: STATE, ACTION, API, PAGE. 새 키워드를 추가하지 않는다.
2. **`key: value` 패턴 통일**: 모든 새 문법이 기존 속성 패턴으로 표현된다.
3. **DSL은 구조, JS는 로직**: 단순 조작은 DSL 내장 패턴, 복잡한 로직은 외부 JS로 위임.
4. **JS 함수 규약 단일화**: `(state, payload) => partialState`
5. **AI 오류율 최소화**: LLM 학습 데이터에 많은 패턴을 우선 채택.

## 프로젝트 구조 변경

```
my-app/
├── app.neuron          # STATE, ACTION
├── pages/
│   ├── home.neuron
│   └── detail.neuron
├── apis/
│   └── todos.neuron
├── logic/              # NEW: JS 로직 파일
│   └── todos.js
├── themes/
│   └── theme.json
├── assets/
└── neuron.json
```

`logic/` 디렉토리는 선택사항이다. `use:` 액션을 사용할 때만 필요하다.

## 1. 액션 시스템 확장

### 1.1 새 내장 패턴 (5종 추가)

기존 `append`, `remove`, `call`에 추가하여 총 8개 내장 패턴:

#### set — 상태 값 직접 설정

```
ACTION clear-search
  set: query -> ""

ACTION set-user
  set: user -> null
```

생성 코드:
```javascript
function action_clearSearch() {
  _setState('query', '');
}
```

#### toggle — boolean 토글

```
ACTION toggle-dark
  toggle: darkMode
```

생성 코드:
```javascript
function action_toggleDark() {
  _setState('darkMode', !_state.darkMode);
}
```

#### increment — 숫자 증가

```
ACTION increase
  increment: count
```

생성 코드:
```javascript
function action_increase() {
  _setState('count', _state.count + 1);
}
```

#### decrement — 숫자 감소

```
ACTION decrease
  decrement: count
```

생성 코드:
```javascript
function action_decrease() {
  _setState('count', _state.count - 1);
}
```

#### navigate — 프로그래밍 방식 라우팅

```
ACTION go-home
  navigate: /
```

생성 코드:
```javascript
function action_goHome() {
  location.hash = '/';
}
```

### 1.2 외부 JS 위임 (`use:`)

복잡한 로직은 JS 파일로 분리한다.

DSL 측:
```
ACTION add-todo
  use: logic/todos.addTodo

ACTION apply-filter
  use: logic/filter.apply
```

JS 측 (`logic/todos.js`):
```javascript
export function addTodo(state, text) {
  return {
    todos: [...state.todos, { id: Date.now(), text, done: false }]
  };
}
```

#### 함수 규약

- 시그니처: `(state: object, payload: any) => object`
- 반환값: 변경할 state 필드만 포함하는 부분 객체
- 반환된 객체의 각 키에 대해 `_setState(key, value)` 호출
- 비동기 함수도 지원: `async (state, payload) => object`

#### 컴파일러 동작

1. `use:` 발견 시 해당 JS 파일 경로 수집
2. 빌드 시 `logic/` 디렉토리의 JS 파일을 `main.js` 상단에 인라인 번들링
3. 액션 함수에서 해당 외부 함수를 호출하고 반환값을 state에 머지

생성 코드:
```javascript
// -- bundled from logic/todos.js --
const _logic_todos = {};
_logic_todos.addTodo = function(state, text) {
  return {
    todos: [...state.todos, { id: Date.now(), text, done: false }]
  };
};

// -- action --
async function action_addTodo(payload) {
  const result = await _logic_todos.addTodo({..._state}, payload);
  if (result && typeof result === 'object') {
    Object.entries(result).forEach(([k, v]) => _setState(k, v));
  }
}
```

#### 에러 처리

```
[NEURON ERROR] logic/todos.js 파일을 찾을 수 없습니다
→ logic/ 디렉토리에 todos.js 파일을 생성하세요

[NEURON ERROR] logic/todos.js에서 "addTodo" 함수를 찾을 수 없습니다
→ export function addTodo(state, payload) { ... } 형태로 내보내세요
```

## 2. 동적 라우팅

### 문법

```
PAGE detail "상품 상세" /product/:id
PAGE edit "수정" /product/:id/edit
PAGE category "카테고리" /category/:catId/item/:itemId
```

콜론 스타일(`:param`)은 Express/React Router 관례를 따른다. AI 학습 데이터에 가장 많은 패턴이다.

### 파서 변경

`PageNode`에 `params: string[]` 필드 추가:

```typescript
interface PageNode {
  type: 'page';
  name: string;
  title: string;
  route: string;
  params: string[];    // NEW: ['id'] or ['catId', 'itemId']
  components: ComponentNode[];
}
```

라우트 문자열에서 `:param` 패턴을 추출하여 `params` 배열에 저장.

### 라우터 생성 변경

현재 정적 매칭:
```javascript
const routes = { '/': 'home', '/product': 'detail' };
```

변경 후 패턴 매칭:
```javascript
const routes = [
  { pattern: /^\/$/, page: 'home', params: [] },
  { pattern: /^\/product\/([^/]+)$/, page: 'detail', params: ['id'] },
  { pattern: /^\/category\/([^/]+)\/item\/([^/]+)$/, page: 'category', params: ['catId', 'itemId'] },
];

function matchRoute(hash) {
  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      const paramValues = {};
      route.params.forEach((name, i) => paramValues[name] = match[i + 1]);
      _setState('_params', paramValues);
      return route.page;
    }
  }
  return routes[0].page; // fallback
}
```

### `_params` 상태

- `_state._params`는 예약된 내부 상태 필드
- 사용자가 STATE에 선언할 필요 없음 (컴파일러가 자동 추가)
- 페이지 전환 시 자동 업데이트
- 컴포넌트에서 참조 가능: `show_if: _params.id`

## 3. 조건부 렌더링

### 문법

```
button "로그아웃" -> logout
  show_if: user

button "로그인" -> /login
  show_if: !user

text
  content: "목록이 비어 있습니다"
  show_if: !todos
```

### 지원 조건

| 문법 | 의미 |
|------|------|
| `show_if: fieldName` | `_state.fieldName`이 truthy면 표시 |
| `show_if: !fieldName` | `_state.fieldName`이 falsy면 표시 |

복잡한 조건(AND/OR, 비교 연산)은 지원하지 않는다. 복잡한 조건이 필요하면 computed state나 `use:` 액션으로 boolean state를 만들어 참조한다.

### 파서 변경

`ComponentNode`에 `showIf` 필드 추가:

```typescript
interface ComponentNode {
  type: 'component';
  componentType: string;
  inlineLabel?: string;
  inlineAction?: string;
  properties: PropertyNode[];
  children: ComponentNode[];
  showIf?: { field: string; negate: boolean };  // NEW
}
```

### 생성 코드

```javascript
// show_if: user → 초기 렌더링 시
const el_btn_1 = document.getElementById('comp-1');
el_btn_1.style.display = _state.user ? '' : 'none';

// 바인딩 등록
_bindings['user'].push((val) => {
  el_btn_1.style.display = val ? '' : 'none';
});

// show_if: !todos → negate
_bindings['todos'].push((val) => {
  el_text_1.style.display = !val || (Array.isArray(val) && val.length === 0) ? '' : 'none';
});
```

배열인 경우 `length === 0`도 falsy로 취급한다.

## 4. 폼 검증

### 문법

```
form
  field_email: "이메일"
    type: email
    required: true
  field_password: "비밀번호"
    type: password
    min: 8
  field_age: "나이"
    type: number
    min: 1
    max: 200
  submit: "가입" -> register
```

폼 필드 하위 속성은 6칸 들여쓰기(필드 4칸 + 속성 2칸 추가).

### 지원 속성

| 속성 | 설명 | HTML 매핑 |
|------|------|-----------|
| `type` | 입력 타입 | `<input type="...">` |
| `required` | 필수 여부 | `required` attribute |
| `min` | 최소값/최소길이 | `min` 또는 `minlength` |
| `max` | 최대값/최대길이 | `max` 또는 `maxlength` |

`type` 지원 값: `text`(기본), `email`, `password`, `number`, `tel`, `url`

`min`/`max` 동작:
- `type: number` → `min`, `max` attribute
- 그 외 → `minlength`, `maxlength` attribute

### 파서 변경

폼 필드 하위 속성을 중첩 파싱:

```typescript
interface FormFieldNode {
  name: string;           // "email", "password" 등
  placeholder: string;    // "이메일", "비밀번호" 등
  validation: {
    type?: string;
    required?: boolean;
    min?: number;
    max?: number;
  };
}
```

### HTML 생성

```html
<input
  name="email"
  placeholder="이메일"
  type="email"
  required
/>
<input
  name="password"
  placeholder="비밀번호"
  type="password"
  minlength="8"
/>
```

### JS 생성

```javascript
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  action_register(data);
});
```

### CSS 추가

```css
input:invalid:not(:placeholder-shown) {
  border-color: var(--color-danger);
}

input:valid:not(:placeholder-shown) {
  border-color: var(--color-primary);
}
```

## 5. 영향받는 모듈 상세

### ast.ts

```typescript
// ActionNode 확장
interface ActionStep {
  key: string;   // 'set' | 'toggle' | 'increment' | 'decrement' | 'navigate' | 'use' | ...
  value: string;
}

// PageNode 확장
interface PageNode {
  params: string[];  // NEW
}

// ComponentNode 확장
interface ComponentNode {
  showIf?: { field: string; negate: boolean };  // NEW
}

// FormFieldNode 추가
interface FormFieldNode {
  name: string;
  placeholder: string;
  validation: {
    type?: string;
    required?: boolean;
    min?: number;
    max?: number;
  };
}
```

### lexer.ts

- 6칸 들여쓰기 토큰 추가 (폼 필드 하위 속성)
- 기존 토큰 타입에 `FIELD_PROPERTY` 추가

### parser.ts

- `parseAction`: `use:` 스텝 파싱
- `parsePage`: 라우트에서 `:param` 추출
- `parseComponent`: `show_if:` 속성을 별도 필드로 파싱
- `parseFormField`: 폼 필드 중첩 속성 파싱 (새 함수)

### generator/js.ts

- `generateAction`: 5개 새 패턴 + `use:` 번들링
- `generateRouter`: 정적 → 패턴 매칭 라우터
- `generateBindings`: `show_if` 바인딩 추가
- `generateFormHandler`: 검증 로직 추가
- `bundleLogic`: `logic/` JS 파일 인라인 번들링 (새 함수)

### components/registry.ts

- `renderForm`: 폼 필드에 type/required/min/max 속성 렌더링

### generator/css.ts

- 폼 검증 상태 스타일 (`:invalid`, `:valid`) 추가

### compiler.ts

- `logic/` 디렉토리 스캔
- `CompileInput`에 `logicFiles: string[]` 추가
- JS 파일 읽기 및 제너레이터 전달

### cli.ts

- `neuron new` 템플릿에 `logic/` 디렉토리 포함

## 6. 에러 메시지 추가

```
[NEURON ERROR] 알 수 없는 액션 패턴: "push"
→ 사용 가능: append, remove, call, set, toggle, increment, decrement, navigate, use

[NEURON ERROR] logic/todos.js 파일을 찾을 수 없습니다
→ logic/ 디렉토리에 todos.js 파일을 생성하세요

[NEURON ERROR] logic/todos.js에서 "addTodo" 함수를 찾을 수 없습니다
→ export function addTodo(state, payload) { ... } 형태로 내보내세요

[NEURON ERROR] show_if 조건이 잘못되었습니다: "user && admin"
→ show_if는 단일 필드만 지원합니다: show_if: user 또는 show_if: !user

[NEURON ERROR] 폼 필드 타입이 잘못되었습니다: "date"
→ 사용 가능: text, email, password, number, tel, url

[NEURON ERROR] 동적 라우트 파라미터 이름이 비어 있습니다: /product/:
→ /product/:id 형태로 파라미터 이름을 지정하세요
```

## 7. 테스트 계획

| 테스트 | 검증 내용 |
|--------|----------|
| lexer: 폼 필드 하위 속성 | 6칸 들여쓰기가 FIELD_PROPERTY 토큰으로 변환 |
| parser: 새 액션 패턴 | set, toggle, increment, decrement, navigate, use 파싱 |
| parser: 동적 라우트 | `/product/:id`에서 params 추출 |
| parser: show_if | `show_if: user`, `show_if: !user` 파싱 |
| parser: 폼 검증 속성 | type, required, min, max 중첩 파싱 |
| generator/js: 새 액션 | 각 패턴별 생성 코드 검증 |
| generator/js: use 번들링 | logic/ JS 파일 인라인 포함 검증 |
| generator/js: 동적 라우터 | 패턴 매칭 + _params 바인딩 |
| generator/js: show_if | display 토글 바인딩 |
| generator/js: 폼 검증 | checkValidity 호출 + 속성 렌더링 |
| e2e: 범용 앱 | 쇼핑몰이 아닌 todo/dashboard 등 범용 예제로 통합 테스트 |

## 8. 범위 밖 (Phase 2 이후)

- 상태 영속성 (localStorage persist) → Phase 2
- 페이지 트랜지션/애니메이션 → Phase 2
- `neuron dev` (watch + live reload) → Phase 3
- 커스텀 컴포넌트 등록 → Phase 4
- 플러그인 시스템 → Phase 4
