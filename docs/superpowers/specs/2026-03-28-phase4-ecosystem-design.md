# Phase 4: 생태계/확장성 설계

> 커스텀 HTML 컴포넌트와 테마 프리셋으로 Neuron DSL의 확장성을 확보한다.

## 배경

Phase 1-3에서 DSL 표현력, 런타임 품질, 개발자 경험을 갖췄다. 하지만:
- 14개 빌트인 컴포넌트만 사용 가능 — 프로젝트별 커스텀 UI가 불가능
- 테마를 매번 직접 작성해야 함 — AI가 "다크 테마"를 한 줄로 지정 불가

## 설계 원칙

1. **빌트인과 동일한 문법**: 커스텀 컴포넌트가 빌트인과 동일하게 사용됨
2. **HTML 템플릿**: AI가 정확하게 생성할 수 있는 `{{prop}}` 패턴
3. **Zero config 프리셋**: 이름 하나로 완성된 테마

## 1. 커스텀 컴포넌트

### 디렉토리 구조

```
my-app/
├── components/           # 커스텀 컴포넌트 디렉토리
│   ├── rating.html       # HTML 템플릿
│   ├── rating.css        # 선택: 컴포넌트별 스타일
│   ├── badge.html
│   └── badge.css
├── app.neuron
├── pages/
└── ...
```

### HTML 템플릿 문법

```html
<!-- components/rating.html -->
<div class="rating">
  <span class="rating__label">{{label}}</span>
  <span class="rating__stars">★ {{value}}</span>
</div>
```

- `{{propName}}` — 컴포넌트 속성 값으로 치환
- 파일명 = 컴포넌트 이름: `rating.html` → DSL에서 `rating`으로 사용
- HTML만 지원. JS 로직이 필요하면 `logic/`에 분리

### DSL 사용

```
PAGE home "Home" /

  rating
    label: "평점"
    value: "4.5"

  badge
    text: "NEW"
    variant: primary
```

빌트인 컴포넌트와 완전히 동일한 문법. 컴파일러가 자동으로 커스텀 렌더러를 적용.

### 컴포넌트별 CSS

```css
/* components/rating.css */
.rating {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.rating__stars {
  color: #f59e0b;
  font-size: var(--font-size-lg);
}
```

- `rating.html`과 같은 이름의 `rating.css`가 있으면 `style.css`에 자동 포함
- CSS 파일은 선택사항. 없으면 HTML만 렌더링
- 테마 CSS 변수(`var(--color-primary)` 등)를 사용 가능

### 컴파일러 동작

1. `components/` 디렉토리 스캔
2. `.html` 파일마다:
   - 파일명에서 컴포넌트 이름 추출 (확장자 제거)
   - 빌트인 컴포넌트와 이름 충돌 체크 → 충돌 시 에러
   - 템플릿 내용을 읽어 커스텀 렌더러 맵에 저장
3. 같은 이름의 `.css` 파일이 있으면 CSS 문자열 수집
4. 렌더링 시 `{{propName}}`을 해당 컴포넌트의 속성 값으로 치환
5. 수집된 커스텀 CSS를 `style.css`에 추가

### 렌더링 로직

```typescript
function renderCustomComponent(template: string, node: ComponentNode): string {
  let html = template;
  for (const prop of node.properties) {
    html = html.replace(new RegExp(`\\{\\{${prop.key}\\}\\}`, 'g'), unquote(prop.value));
  }
  // Remove unused placeholders
  html = html.replace(/\{\{\w+\}\}/g, '');
  return html;
}
```

### 에러 처리

```
[NEURON ERROR] 커스텀 컴포넌트 "header"가 빌트인 컴포넌트와 이름이 충돌합니다
→ 다른 이름을 사용하세요. 빌트인: header, footer, section, grid, hero, ...
```

## 2. 테마 프리셋

### 빌트인 프리셋

#### default
현재 기본 테마. 밝은 배경, 파란 primary.
```json
{
  "colors": { "primary": "#2E86AB", "secondary": "#A23B72", "danger": "#E84855", "bg": "#FFFFFF", "text": "#1A1A2E", "border": "#E0E0E0" },
  "font": { "family": "Inter", "size": { "sm": 14, "md": 16, "lg": 20, "xl": 28 } },
  "radius": 8, "shadow": "0 2px 8px rgba(0,0,0,0.1)", "spacing": { "sm": 8, "md": 16, "lg": 24, "xl": 48 },
  "transition": "none"
}
```

#### dark
어두운 배경, 밝은 텍스트, 시안 primary.
```json
{
  "colors": { "primary": "#00D4AA", "secondary": "#BB86FC", "danger": "#CF6679", "bg": "#121212", "text": "#E0E0E0", "border": "#333333" },
  "font": { "family": "Inter", "size": { "sm": 14, "md": 16, "lg": 20, "xl": 28 } },
  "radius": 8, "shadow": "0 2px 8px rgba(0,0,0,0.3)", "spacing": { "sm": 8, "md": 16, "lg": 24, "xl": 48 },
  "transition": "none"
}
```

#### minimal
모노크롬, 극도로 단순한 디자인.
```json
{
  "colors": { "primary": "#000000", "secondary": "#666666", "danger": "#CC0000", "bg": "#FFFFFF", "text": "#000000", "border": "#CCCCCC" },
  "font": { "family": "Georgia", "size": { "sm": 14, "md": 16, "lg": 20, "xl": 28 } },
  "radius": 0, "shadow": "none", "spacing": { "sm": 8, "md": 16, "lg": 24, "xl": 48 },
  "transition": "none"
}
```

#### vibrant
선명한 색상, 부드러운 모서리.
```json
{
  "colors": { "primary": "#FF6B6B", "secondary": "#4ECDC4", "danger": "#FF4757", "bg": "#FAFAFA", "text": "#2D3436", "border": "#DFE6E9" },
  "font": { "family": "Poppins", "size": { "sm": 14, "md": 16, "lg": 20, "xl": 28 } },
  "radius": 12, "shadow": "0 4px 16px rgba(0,0,0,0.08)", "spacing": { "sm": 8, "md": 16, "lg": 24, "xl": 48 },
  "transition": "fade"
}
```

### neuron.json에서 지정

```json
{
  "name": "My App",
  "theme": "dark"
}
```

### 우선순위

1. `themes/theme.json` 파일 존재 → 그대로 사용 (최우선)
2. `neuron.json`의 `theme` 필드 → 프리셋 로드
3. 둘 다 없음 → `default` 프리셋

### scaffold 옵션

```bash
neuron new my-app --theme dark
```

- `neuron.json`에 `"theme": "dark"` 설정
- `themes/theme.json`은 생성하지 않음 (프리셋 사용)
- `--theme` 없으면 기존 동작 (theme.json 생성)

### 구현

프리셋은 `src/theme-presets.ts`에 Theme 객체로 하드코딩:

```typescript
import type { Theme } from './theme';

export const PRESETS: Record<string, Theme> = {
  default: { ... },
  dark: { ... },
  minimal: { ... },
  vibrant: { ... },
};
```

`loadTheme`에 프리셋 로딩 추가:

```typescript
export function loadTheme(path: string | null, presetName?: string): Theme {
  if (path) {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_THEME, ...parsed, transition: parsed.transition || 'none' };
  }
  if (presetName && PRESETS[presetName]) {
    return { ...PRESETS[presetName] };
  }
  return { ...DEFAULT_THEME };
}
```

## 3. 영향받는 모듈

| 모듈 | 변경 |
|------|------|
| `src/theme-presets.ts` | **새 파일**: 4개 프리셋 Theme 객체 |
| `src/theme.ts` | `loadTheme`에 preset 파라미터 추가 |
| `src/compiler.ts` | `components/` 스캔, 커스텀 렌더러/CSS 수집, neuron.json에서 preset 읽기 |
| `src/components/registry.ts` | 커스텀 렌더러 등록 + 렌더링 폴백 |
| `src/generator/css.ts` | 커스텀 컴포넌트 CSS 추가 |
| `src/cli.ts` | `neuron new --theme` 옵션 |
| `src/scaffold.ts` | `components/` 디렉토리 생성, `--theme` 옵션 |
| `src/errors.ts` | `component_name_conflict` 에러 코드 |

## 4. 테스트 계획

| 테스트 | 검증 내용 |
|--------|----------|
| theme-presets: 프리셋 로딩 | 4개 프리셋이 모두 유효한 Theme 객체 |
| theme: preset 파라미터 | `loadTheme(null, 'dark')` → dark 테마 |
| theme: 파일 우선순위 | path가 있으면 preset 무시 |
| registry: 커스텀 렌더러 | 커스텀 템플릿 + 속성 바인딩 |
| registry: 빌트인 충돌 | 빌트인 이름 사용 시 에러 |
| registry: 미사용 플레이스홀더 | `{{unused}}` → 빈 문자열 |
| compiler: components/ 스캔 | HTML/CSS 파일 자동 수집 |
| compiler: neuron.json preset | `"theme": "dark"` → dark 테마 적용 |
| css: 커스텀 CSS 포함 | 커스텀 CSS가 style.css에 추가 |
| cli: --theme 옵션 | scaffold에 theme 설정 |
| e2e: 커스텀 컴포넌트 | 전체 파이프라인 통합 |

## 5. 범위 밖

- 플러그인 훅 / 빌드 파이프라인 확장 → 불필요
- npm 패키지로 컴포넌트 배포 → 향후 고려
- 커스텀 컴포넌트의 JS 로직 → `logic/`으로 분리하여 처리
- 커스텀 컴포넌트의 children/slot 지원 → v1은 flat 속성만
