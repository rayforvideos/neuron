// src/errors.ts
export type ErrorCode = 'unknown_component' | 'undefined_state' | 'undefined_action' | 'undefined_api' | 'parse_error';

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
};

export function formatError(err: NeuronError): string {
  return messages[err.code](err.target, err.meta);
}
