# Phase 2: 런타임 품질 설계

> Neuron DSL이 생성하는 SPA의 런타임 품질을 개선한다.
> DSL 변경을 최소화하고, 컴파일러가 자동으로 품질 높은 출력을 생성하도록 한다.

## 배경

Phase 1에서 DSL 표현력을 확장했다. 하지만 생성되는 앱의 런타임 품질에 문제가 있다:

- 페이지 전환이 즉시 교체라 어색함
- 상태가 새로고침하면 사라짐
- 모바일에서 레이아웃이 깨짐
- API 호출 시 로딩/에러 피드백 없음

## 설계 원칙

1. **DSL 변경 최소화**: `persist:` 한 줄만 추가. 나머지는 전부 자동.
2. **Sensible defaults**: 반응형, 로딩/에러 UI는 설정 없이 작동.
3. **기존 기능과 연동**: `_loading`/`_error`는 Phase 1의 `show_if`로 참조 가능.

## 1. 페이지 트랜지션

### 테마 설정

`themes/theme.json`에 `transition` 필드 추가:

```json
{
  "colors": { ... },
  "font": { ... },
  "transition": "fade"
}
```

지원 값: `"fade"`, `"slide"`, `"none"` (기본값: `"none"`)

### CSS 생성

`transition: "fade"` 일 때:
```css
[data-page] {
  opacity: 0;
  transition: opacity 0.3s ease;
  position: absolute;
  width: 100%;
}
[data-page].neuron-page-active {
  opacity: 1;
  position: relative;
}
```

`transition: "slide"` 일 때:
```css
[data-page] {
  transform: translateX(20px);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
  position: absolute;
  width: 100%;
}
[data-page].neuron-page-active {
  transform: translateX(0);
  opacity: 1;
  position: relative;
}
```

`transition: "none"` 일 때 (기본): 기존 동작 유지 (`display: none` / `display: ''`).

### 라우터 변경

`_render` 함수가 트랜지션 모드에 따라 동작 변경:

- `none`: 기존대로 `style.display` 토글
- `fade`/`slide`: `neuron-page-active` 클래스를 토글. 이전 페이지에서 클래스 제거 → 트랜지션 후 `display: none`. 새 페이지에 `display: ''` → 다음 프레임에 클래스 추가.

```javascript
function _render(route) {
  var pageName = _matchRoute(route);
  document.querySelectorAll('[data-page]').forEach(function(el) {
    if (el.getAttribute('data-page') === pageName) {
      el.style.display = '';
      requestAnimationFrame(function() {
        el.classList.add('neuron-page-active');
      });
    } else {
      el.classList.remove('neuron-page-active');
      // After transition ends, hide completely
      el.addEventListener('transitionend', function handler() {
        if (!el.classList.contains('neuron-page-active')) {
          el.style.display = 'none';
        }
        el.removeEventListener('transitionend', handler);
      });
    }
  });
}
```

트랜지션 모드가 `none`이면 기존 로직 그대로 유지.

### Theme 타입 변경

```typescript
interface Theme {
  colors: Record<string, string>;
  font: { family: string; size: Record<string, number> };
  radius: number;
  shadow: string;
  spacing: Record<string, number>;
  transition?: 'fade' | 'slide' | 'none';  // NEW
}
```

## 2. 상태 영속성

### 문법

`STATE` 블록에 `persist:` 속성 추가:

```
STATE persist: cart, user
  cart: []
  user: null
  tempData: ""
```

`persist:` 뒤에 쉼표로 구분된 필드 목록. 해당 필드만 localStorage에 저장/복원.

`persist:`가 없으면 어떤 상태도 저장되지 않는다 (기존 동작).

### 파서 변경

`StateNode`에 `persist: string[]` 추가:

```typescript
export interface StateNode {
  type: 'STATE';
  fields: StateField[];
  persist: string[];  // NEW
}
```

렉서: `persist:` 라인은 기존 PROPERTY 토큰으로 처리됨 (key: `persist`, value: `cart, user`).

파서: STATE 파싱 시 `persist` 속성을 만나면 쉼표로 분리하여 `node.persist` 배열에 저장.

### JS 생성

`_setState` 함수에 persist 로직 추가:

```javascript
var _persistFields = ['cart', 'user'];

function _setState(key, val) {
  _state[key] = val;
  (_bindings[key] || []).forEach(function(fn) { fn(val); });
  if (_persistFields.indexOf(key) !== -1) {
    try { localStorage.setItem('neuron:' + key, JSON.stringify(val)); } catch(e) {}
  }
}
```

앱 초기화 시 복원:

```javascript
function _initPersist() {
  _persistFields.forEach(function(key) {
    try {
      var stored = localStorage.getItem('neuron:' + key);
      if (stored !== null) {
        _state[key] = JSON.parse(stored);
        (_bindings[key] || []).forEach(function(fn) { fn(_state[key]); });
      }
    } catch(e) {}
  });
}
```

`DOMContentLoaded`에서 `_initPersist()`를 `_initBindings()` 다음, `_initRouter()` 전에 호출.

### 키 네이밍

localStorage 키: `neuron:{fieldName}` (예: `neuron:cart`). 다른 앱과 충돌 방지.

## 3. 반응형 레이아웃

### DSL 변경 없음

순수 CSS 추가. `generator/css.ts`의 `BASE_STYLES`에 미디어 쿼리 추가.

### 반응형 CSS

```css
@media (max-width: 768px) {
  .neuron-product-grid,
  .neuron-grid {
    grid-template-columns: 1fr !important;
  }

  .neuron-header {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .neuron-header nav {
    flex-wrap: wrap;
    justify-content: center;
  }

  .neuron-hero {
    padding: var(--spacing-lg) var(--spacing-md);
  }
  .neuron-hero h2 {
    font-size: var(--font-size-lg);
  }

  .neuron-form {
    padding: var(--spacing-md);
    max-width: 100%;
  }

  .neuron-cart-item {
    flex-wrap: wrap;
  }
  .neuron-cart-item__img {
    width: 60px;
    height: 60px;
  }

  .neuron-modal-body {
    min-width: auto;
    margin: var(--spacing-md);
    max-width: calc(100vw - var(--spacing-lg));
  }
}
```

### viewport meta

`generator/html.ts`에서 이미 `<meta name="viewport" content="width=device-width, initial-scale=1.0">`을 생성 중. 변경 불필요.

## 4. 로딩/에러 UI

### 내부 상태

컴파일러가 자동으로 `_loading`과 `_error` 내부 상태를 생성:

```javascript
const _state = {
  // user-defined states...
  "_loading": {},   // { apiName: true/false }
  "_error": {},     // { apiName: "message" / null }
  "_params": {}
};
```

### API 호출 래핑

`on_load: true` API 자동 호출 시:

```javascript
function _autoLoad() {
  _setState('_loading', Object.assign({}, _state._loading, { products: true }));
  fetch('/api/products')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      _setState('products', data);
      _setState('_loading', Object.assign({}, _state._loading, { products: false }));
      _setState('_error', Object.assign({}, _state._error, { products: null }));
    })
    .catch(function(err) {
      _setState('_loading', Object.assign({}, _state._loading, { products: false }));
      _setState('_error', Object.assign({}, _state._error, { products: err.message }));
    });
}
```

`call` 액션도 동일하게 래핑.

### 데이터 컴포넌트 로딩 표시

`product-grid`, `list`, `table`의 런타임 렌더러가 로딩/에러 상태를 자동 체크:

```javascript
function _renderGrid0(items) {
  document.querySelectorAll('.neuron-product-grid').forEach(function(grid) {
    var source = grid.getAttribute('data-source');
    // Show loading
    if (_state._loading[source]) {
      grid.innerHTML = '<div class="neuron-loading"></div>';
      return;
    }
    // Show error
    if (_state._error[source]) {
      grid.innerHTML = '<div class="neuron-error">' + _state._error[source] + '</div>';
      return;
    }
    // Normal rendering...
  });
}
```

### CSS

로딩 스피너와 에러 배너 스타일:

```css
.neuron-loading {
  text-align: center;
  padding: var(--spacing-xl);
}
.neuron-loading::after {
  content: '';
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: neuron-spin 0.6s linear infinite;
}
@keyframes neuron-spin {
  to { transform: rotate(360deg); }
}

.neuron-error {
  padding: var(--spacing-md);
  background: #fef2f2;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  margin: var(--spacing-md) 0;
}
```

### show_if 연동

사용자가 `show_if: _loading` 또는 `show_if: _error`로 커스텀 로딩/에러 UI를 만들 수도 있다. 하지만 기본적으로 데이터 컴포넌트에 자동 표시되므로 필수는 아님.

## 5. 영향받는 모듈 상세

### ast.ts

```typescript
export interface StateNode {
  type: 'STATE';
  fields: StateField[];
  persist: string[];  // NEW
}
```

### theme.ts

```typescript
interface Theme {
  // ... existing fields
  transition?: 'fade' | 'slide' | 'none';  // NEW
}
```

`loadTheme`에서 `transition` 필드를 읽고 기본값 `'none'` 적용.

### lexer.ts

변경 없음. `persist: cart, user`는 기존 PROPERTY 토큰으로 처리됨.

### parser.ts

- `parseState`: `persist` 속성을 만나면 쉼표로 분리하여 `node.persist`에 저장
- `StateNode` 생성 시 `persist: []` 기본값

### generator/js.ts

- `generateState`: `_loading: {}`, `_error: {}` 내부 상태 추가
- `generateBindings`: `_loading`, `_error` 바인딩 추가
- `generateSetState`: persist 필드 체크 및 localStorage 저장 로직
- `generateRouter`: 트랜지션 모드에 따른 `_render` 함수 분기
- `generateAutoLoad`: 로딩/에러 상태 래핑
- `generateActions` (call 패턴): 로딩/에러 상태 래핑
- `generateRuntimeRenderers`: 로딩/에러 자동 체크 삽입
- `generateInit`: `_initPersist()` 호출 추가
- 새 함수: `generatePersist()` — `_persistFields` 배열 및 `_initPersist` 함수

### generator/css.ts

- 트랜지션 CSS (fade/slide)
- 반응형 미디어 쿼리
- 로딩 스피너 + 에러 배너 스타일

`generateCSS`가 `theme.transition` 값을 받아 해당 트랜지션 CSS만 포함.

### generator/html.ts

변경 없음.

### components/registry.ts

변경 없음.

### compiler.ts

- `theme.transition` 값을 `generateCSS`에 전달 (이미 theme 객체로 전달 중이므로 추가 작업 없음)

## 6. 테스트 계획

| 테스트 | 검증 내용 |
|--------|----------|
| parser: persist 파싱 | `persist: cart, user` → `['cart', 'user']` |
| parser: persist 없을 때 | `persist: []` 기본값 |
| theme: transition 로딩 | `transition: "fade"` 파싱 |
| theme: transition 기본값 | transition 없으면 `"none"` |
| generator/js: persist | `_persistFields` 배열 + `_initPersist` 함수 |
| generator/js: 트랜지션 라우터 | fade 모드에서 `neuron-page-active` 클래스 토글 |
| generator/js: 로딩 상태 | `_loading` 상태 설정/해제 |
| generator/js: 에러 상태 | `_error` 상태 설정/해제 |
| generator/js: 데이터 컴포넌트 로딩 | 렌더러에 로딩 체크 포함 |
| generator/css: 반응형 | `@media (max-width: 768px)` 포함 |
| generator/css: 트랜지션 | fade 모드에서 `opacity` 트랜지션 포함 |
| generator/css: 로딩/에러 | `.neuron-loading`, `.neuron-error` 스타일 |
| e2e: 전체 통합 | 모든 Phase 2 기능이 포함된 앱 컴파일 |

## 7. 범위 밖

- 커스텀 트랜지션 (사용자 정의 CSS) → Phase 4
- 상태 영속성 sessionStorage 옵션 → 필요 시 추가
- SSR / SEO → 범위 밖
- 오프라인 지원 (Service Worker) → 범위 밖
