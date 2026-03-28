# Neuron DSL Reference

> This file is the complete reference for the Neuron DSL.
> If you are an AI agent working on a Neuron project, read this file to understand the full syntax.
> The project config file `neuron.json` points here via the `"reference"` field.

## Overview

Neuron is a declarative DSL that compiles `.neuron` files into single-page applications (HTML + CSS + JS). It uses exactly **4 keywords**: `STATE`, `ACTION`, `API`, `PAGE`.

Build command: `neuron build` (run from project root)

## Project Structure

```
project/
├── neuron.json              # Project config (required)
├── app.neuron               # Global state & actions (required)
├── pages/
│   ├── home.neuron          # One file per page (required: at least one)
│   └── *.neuron
├── apis/
│   └── *.neuron             # API definitions (optional)
├── themes/
│   └── theme.json           # Design tokens (optional, has defaults)
├── assets/                  # Static files (copied to dist/assets/)
└── logic/              # External JS logic (optional)
    └── *.js
```

## neuron.json

```json
{
  "name": "Project Name",
  "reference": "node_modules/neuron-dsl/REFERENCE.md"
}
```

## Keyword 1: STATE (app.neuron)

Defines global application state. Each field has a name and default value.

```
STATE
  fieldName: defaultValue
  cart: []
  products: []
  user: null
  query: ""
  count: 0
  active: false
```

Types are inferred from default values: `[]` = array, `null` = nullable, `""` = string, `0` = number, `false` = boolean.

### State Persistence

```
STATE persist: cart, user
  cart: []
  user: null
  temp: ""
```

Fields listed after `persist:` are automatically saved to localStorage and restored on page load. Key format: `neuron:{fieldName}`.

## Keyword 2: ACTION (app.neuron)

Defines state mutations. Must come after `STATE`, separated by `---`.

```
STATE
  cart: []
  products: []

---

ACTION action-name
  step-key: step-value
```

### Action patterns

**append** - Add item to array:
```
ACTION add-to-cart
  append: product -> cart
```
Generated: `function(item) { _setState('cart', [..._state.cart, item]); }`

**remove** - Remove by id match:
```
ACTION remove-from-cart
  remove: cart where id matches
```
Generated: `function(id) { _setState('cart', _state.cart.filter(i => i.id !== id)); }`

**call** - Call an API:
```
ACTION checkout
  call: orders
  on_success: -> /complete
  on_error: show-error
```

Call options:
- `on_success: -> /route` - navigate on success
- `on_success: stateName` - set state with response data
- `on_error: label` - console.error label
- `query: stateField` - append `?q=stateValue` to URL
- `target: stateField` - set state with response data

**set** - Set state to a specific value:
```
ACTION clear-search
  set: query -> ""
```
Generated: `function() { _setState('query', ''); }`

**toggle** - Toggle boolean state:
```
ACTION toggle-dark
  toggle: darkMode
```
Generated: `function() { _setState('darkMode', !_state.darkMode); }`

**increment** - Increment number state:
```
ACTION increase
  increment: count
```
Generated: `function() { _setState('count', _state.count + 1); }`

**decrement** - Decrement number state:
```
ACTION decrease
  decrement: count
```
Generated: `function() { _setState('count', _state.count - 1); }`

**navigate** - Programmatic navigation:
```
ACTION go-home
  navigate: /
```
Generated: `function() { _navigate('/'); }`

**use** - Delegate to external JS function:
```
ACTION add-todo
  use: logic/todos.addTodo
```
JS function convention: `(state, payload) => partialState`

### Dynamic Routes

```
PAGE detail "Detail" /item/:id
PAGE edit "Edit" /category/:catId/item/:itemId
```

Route parameters are available as `_state._params` (e.g., `_state._params.id`).

## Keyword 3: API (apis/*.neuron)

Defines HTTP endpoints. One API per file. File goes in `apis/` directory.

```
API name
  METHOD /endpoint
  option: value
```

### Options

| Option | Values | Description |
|--------|--------|-------------|
| `on_load` | `true` | Auto-fetch when page loads |
| `body` | state field name | Send state as JSON body (POST) |
| `returns` | type name | Return type (documentation only) |

### Example

```
API products
  GET /api/products
  on_load: true
  returns: Product[]
```

**Important:** API name must match a STATE field name for auto-binding. `API products` binds to `STATE.products`.

## Keyword 4: PAGE (pages/*.neuron)

Defines a page with components. One page per file. File goes in `pages/` directory.

```
PAGE id "Display Title" /route

  component-type
    property: value
```

### Indentation rules
- `PAGE` line: no indentation
- Components: 2 spaces
- Properties: 4 spaces
- Blank lines between components are optional but recommended

### Example

```
PAGE home "Home" /

  header
    title: "My App"
    links: [Products>/products, Cart>/cart]

  hero
    title: "Welcome"
    subtitle: "Get started"
    cta: "Shop Now" -> /products

  footer
    text: "© 2026 My App"
```

## Conditional Rendering

```
button "Logout" -> logout
  show_if: user

button "Login" -> /login
  show_if: !user
```

| Syntax | Meaning |
|--------|---------|
| `show_if: field` | Show when `_state.field` is truthy |
| `show_if: !field` | Show when `_state.field` is falsy |

## Components

### Layout

**header**
```
header
  title: "App Name"
  logo: "logo.png"                    # optional
  links: [Label>/route, Label>/route]  # optional
```

**footer**
```
footer
  text: "Footer text"
```

**section** - Generic container, supports nested components
```
section
  text
    content: "Hello"
```

**grid** - CSS grid layout
```
grid
  cols: 3
```

**hero** - Full-width banner
```
hero
  title: "Heading"
  subtitle: "Subheading"
  cta: "Button Label" -> /route      # link-style CTA
  cta: "Button Label" -> action-name  # action-style CTA
```

### Data Display

**product-grid** - Renders items from state as a card grid
```
product-grid
  data: stateField          # required: which state array to render
  cols: 3                   # optional: grid columns (default: 3)
  on_click: action-name     # optional: action when card button clicked
  image: fieldName          # optional: item field for image URL
  title: fieldName          # optional: item field for title text
  subtitle: fieldName       # optional: item field for subtitle text
  price: fieldName          # optional: item field for price (auto-formatted with toLocaleString)
  id: fieldName             # optional: item field for unique ID (default: "id")
```

Without field mappings, cards render empty. Always specify field mappings for your data shape.

**list** - Generic list
```
list
  data: stateField
```

**table** - Tabular data
```
table
  data: stateField
  cols: 3
```

**text** - Text content
```
text
  content: "Some text"
  size: sm|md|lg|xl          # optional (default: md)
```

**image**
```
image
  src: "path/to/image.png"
  alt: "Description"
```

### State-Bound Components

**cart-icon** - Badge showing item count
```
cart-icon
  state: stateField          # which state array to count
```

**cart-list** - Renders items with remove buttons
```
cart-list
  state: stateField          # required: which state array to render
  on_remove: action-name     # optional: action for remove button
  image: fieldName           # optional: item field for image
  title: fieldName           # optional: item field for title
  subtitle: fieldName        # optional: item field for subtitle
  price: fieldName           # optional: item field for price
  id: fieldName              # optional: item field for ID (default: "id")
  empty_text: "Custom text"  # optional: text shown when list is empty
```

**cart-summary** - Shows item count and total
```
cart-summary
  state: stateField          # required: which state array
  price: fieldName           # optional: item field to sum for total
  count_label: "Items"       # optional: label for count row
  total_label: "Total"       # optional: label for total row
```

### Interactive Components

**button** - Two syntax forms:

Inline (requires action):
```
button "Label" -> /route
button "Label" -> action-name
```

Property-style:
```
button
  label: "Label"
  variant: primary|secondary|danger|ghost|default
  action: action-name        # optional
```

**form** with validation
```
form
  field_email: "Email"
    type: email
    required: true
  field_age: "Age"
    type: number
    min: 1
    max: 200
  submit: "Save" -> save
```

Validation attributes: `type` (text/email/password/number/tel/url), `required` (true), `min`, `max`

**search**
```
search
  placeholder: "Search..."
  state: stateField
```

**modal**
```
modal
  state: stateField
  title: "Modal Title"
```

**tabs**
```
tabs
  items: [Tab1, Tab2, Tab3]
```

## External Logic (logic/*.js)

Complex business logic lives in plain JS files:

```javascript
// logic/todos.js
export function addTodo(state, payload) {
  return {
    todos: [...state.todos, { id: Date.now(), text: payload.text, done: false }]
  };
}
```

**Convention:** `(state, payload) => partialState`
- `state`: read-only copy of current state
- `payload`: data passed from the action caller
- Return: object with only the state fields to update

Reference from DSL: `use: logic/todos.addTodo`

## Theme (themes/theme.json)

```json
{
  "colors": {
    "primary": "#2E86AB",
    "secondary": "#A23B72",
    "danger": "#E84855",
    "bg": "#FFFFFF",
    "text": "#1A1A2E",
    "border": "#E0E0E0"
  },
  "font": {
    "family": "Inter",
    "size": { "sm": 14, "md": 16, "lg": 20, "xl": 28 }
  },
  "radius": 8,
  "shadow": "0 2px 8px rgba(0,0,0,0.1)",
  "spacing": { "sm": 8, "md": 16, "lg": 24, "xl": 48 }
}
```

Components use `variant` property to reference theme colors: `primary`, `secondary`, `danger`, `ghost`, `default`.

### Transitions

Add `transition` to theme.json:

```json
{
  "transition": "fade"
}
```

Values: `"fade"` (opacity), `"slide"` (translateX + opacity), `"none"` (default, instant)

## Loading & Error States

API calls automatically track loading and error states:

- `_state._loading.apiName` — `true` while fetching, `false` when done
- `_state._error.apiName` — error message string or `null`

Data components (`product-grid`, `cart-list`) automatically display:
- Spinner while loading
- Error message on failure

Use `show_if` for custom loading/error UI:
```
text
  content: "Loading..."
  show_if: _loading
```

## Responsive Layout

All generated apps include automatic responsive CSS. At screen widths below 768px:
- Grids collapse to single column
- Header navigation wraps
- Hero sections reduce padding
- Forms expand to full width

## Build Output

`neuron build` produces:

```
dist/
├── index.html    # SPA with all pages (hidden/shown via router)
├── style.css     # Theme variables + component styles
├── main.js       # State management, routing, runtime renderers
└── assets/       # Copied from project assets/
```

## Key Constraints

1. **API name = STATE field name** for auto-binding (e.g., `API products` binds to `STATE.products`)
2. **One page per file** in `pages/` directory
3. **One API per file** in `apis/` directory
4. **Indentation matters**: 2 spaces for components, 4 spaces for properties
5. **STATE and ACTION** share `app.neuron`, separated by `---`
6. **Field mappings** on data components (`product-grid`, `cart-list`, `cart-summary`) must match your data's actual field names
7. **Static assets** in `assets/` are copied to `dist/assets/` on build
