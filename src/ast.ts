// src/ast.ts

export interface StateField {
  name: string;
  defaultValue: string; // raw value: "[]", "null", '""', "false"
}

export interface StateNode {
  type: 'STATE';
  fields: StateField[];
  persist: string[];
}

export interface ActionStep {
  key: string;   // "append", "remove", "call", "on_success", "on_error", "query", "target"
  value: string;
}

export interface ActionNode {
  type: 'ACTION';
  name: string;
  steps: ActionStep[];
}

export interface ApiNode {
  type: 'API';
  name: string;
  method: string;       // "GET" | "POST"
  endpoint: string;     // "/api/products"
  options: Record<string, string>; // on_load, body, returns, etc.
}

export interface ComponentProperty {
  key: string;
  value: string;
  validation?: FormFieldValidation;
}

export interface FormFieldValidation {
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
}

export interface ComponentNode {
  type: 'COMPONENT';
  componentType: string;  // "header", "hero", "button", etc.
  inlineLabel?: string;   // button "텍스트"
  inlineAction?: string;  // -> /path or -> action
  properties: ComponentProperty[];
  children: ComponentNode[];
  showIf?: { field: string; negate: boolean };
}

export interface PageNode {
  type: 'PAGE';
  name: string;       // "home"
  title: string;      // "홈"
  route: string;      // "/"
  params: string[];
  components: ComponentNode[];
}

export type TopLevelNode = StateNode | ActionNode | ApiNode | PageNode;

export interface NeuronAST {
  states: StateNode[];
  actions: ActionNode[];
  apis: ApiNode[];
  pages: PageNode[];
}
