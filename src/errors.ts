// src/errors.ts
export type ErrorCode =
  | 'unknown_component'
  | 'undefined_state'
  | 'undefined_action'
  | 'undefined_api'
  | 'parse_error'
  | 'unknown_action_pattern'
  | 'logic_file_not_found'
  | 'logic_function_not_found'
  | 'invalid_show_if'
  | 'invalid_form_field_type'
  | 'invalid_route_param';

export class NeuronError extends Error {
  code: ErrorCode;
  target: string;
  meta: Record<string, unknown>;

  constructor(code: ErrorCode, target: string, meta: Record<string, unknown> = {}) {
    super(`${code}: ${target}`);
    this.code = code;
    this.target = target;
    this.meta = meta;
  }
}

const messages: Record<ErrorCode, (target: string, meta: Record<string, unknown>) => string> = {
  unknown_component: (target, meta) => {
    const suggestions = (meta.suggestions as string[]) || [];
    return `[NEURON ERROR] 알 수 없는 컴포넌트: "${target}"\n→ 사용 가능: ${suggestions.join(', ')}`;
  },
  undefined_state: (target) =>
    `[NEURON ERROR] state "${target}" 가 정의되지 않음\n→ app.neuron STATE 섹션에 "${target}: []" 를 추가하세요`,
  undefined_action: (target) =>
    `[NEURON ERROR] action "${target}" 가 정의되지 않음\n→ app.neuron ACTION 섹션에 "${target}" 를 추가하세요`,
  undefined_api: (target) =>
    `[NEURON ERROR] API "${target}" 가 정의되지 않음\n→ apis/${target}.neuron 파일을 생성하세요`,
  parse_error: (target) =>
    `[NEURON ERROR] 파싱 오류: ${target}`,
  unknown_action_pattern: (target) =>
    `[NEURON ERROR] 알 수 없는 액션 패턴: "${target}"\n→ 사용 가능: append, remove, call, set, toggle, increment, decrement, navigate, use`,
  logic_file_not_found: (target) =>
    `[NEURON ERROR] ${target} 파일을 찾을 수 없습니다\n→ logic/ 디렉토리에 해당 파일을 생성하세요`,
  logic_function_not_found: (target, meta) =>
    `[NEURON ERROR] ${meta.file}에서 "${target}" 함수를 찾을 수 없습니다\n→ export function ${target}(state, payload) { ... } 형태로 내보내세요`,
  invalid_show_if: (target) =>
    `[NEURON ERROR] show_if 조건이 잘못되었습니다: "${target}"\n→ show_if는 단일 필드만 지원합니다: show_if: user 또는 show_if: !user`,
  invalid_form_field_type: (target) =>
    `[NEURON ERROR] 폼 필드 타입이 잘못되었습니다: "${target}"\n→ 사용 가능: text, email, password, number, tel, url`,
  invalid_route_param: (target) =>
    `[NEURON ERROR] 동적 라우트 파라미터 이름이 비어 있습니다: ${target}\n→ /product/:id 형태로 파라미터 이름을 지정하세요`,
};

export function formatError(err: NeuronError): string {
  return messages[err.code](err.target, err.meta);
}
