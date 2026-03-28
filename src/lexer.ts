export type Token =
  | { type: 'KEYWORD'; value: 'STATE'; indent: number; line: number }
  | { type: 'KEYWORD'; value: 'ACTION'; name: string; indent: number; line: number }
  | { type: 'KEYWORD'; value: 'PAGE'; name: string; title: string; route: string; indent: number; line: number }
  | { type: 'KEYWORD'; value: 'API'; name: string; indent: number; line: number }
  | { type: 'PROPERTY'; key: string; value: string; indent: number; line: number }
  | { type: 'COMPONENT'; componentType: string; inlineLabel?: string; inlineAction?: string; indent: number; line: number }
  | { type: 'HTTP_METHOD'; method: string; endpoint: string; indent: number; line: number }
  | { type: 'SEPARATOR'; indent: number; line: number }
  | { type: 'LIST_ITEM'; value: string; indent: number; line: number };

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

export function tokenize(input: string): Token[] {
  const lines = input.split('\n');
  const tokens: Token[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;

    // Skip blank lines
    if (raw.trim() === '') continue;

    const indent = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();

    // --- SEPARATOR
    if (trimmed === '---') {
      tokens.push({ type: 'SEPARATOR', indent, line: lineNum });
      continue;
    }

    // - LIST_ITEM
    if (trimmed.startsWith('- ')) {
      tokens.push({ type: 'LIST_ITEM', value: trimmed.slice(2), indent, line: lineNum });
      continue;
    }

    // STATE keyword (with optional persist)
    if (trimmed === 'STATE' || trimmed.startsWith('STATE persist:')) {
      tokens.push({ type: 'KEYWORD', value: 'STATE', indent, line: lineNum });
      if (trimmed.startsWith('STATE persist:')) {
        const persistValue = trimmed.slice('STATE persist:'.length).trim();
        tokens.push({ type: 'PROPERTY', key: 'persist', value: persistValue, indent: indent + 2, line: lineNum });
      }
      continue;
    }

    // ACTION keyword
    const actionMatch = trimmed.match(/^ACTION\s+(\S+)$/);
    if (actionMatch) {
      tokens.push({ type: 'KEYWORD', value: 'ACTION', name: actionMatch[1], indent, line: lineNum });
      continue;
    }

    // PAGE keyword
    const pageMatch = trimmed.match(/^PAGE\s+(\S+)\s+"([^"]+)"\s+(\S+)$/);
    if (pageMatch) {
      tokens.push({ type: 'KEYWORD', value: 'PAGE', name: pageMatch[1], title: pageMatch[2], route: pageMatch[3], indent, line: lineNum });
      continue;
    }

    // API keyword
    const apiMatch = trimmed.match(/^API\s+(\S+)$/);
    if (apiMatch) {
      tokens.push({ type: 'KEYWORD', value: 'API', name: apiMatch[1], indent, line: lineNum });
      continue;
    }

    // HTTP methods
    const httpMatch = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(\S+)$/);
    if (httpMatch) {
      tokens.push({ type: 'HTTP_METHOD', method: httpMatch[1], endpoint: httpMatch[2], indent, line: lineNum });
      continue;
    }

    // PROPERTY: key: value
    const propMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)$/);
    if (propMatch) {
      tokens.push({ type: 'PROPERTY', key: propMatch[1], value: propMatch[2], indent, line: lineNum });
      continue;
    }

    // COMPONENT with inline label and action: componentName "label" -> /action
    const inlineMatch = trimmed.match(/^(\w[\w-]*)\s+"([^"]+)"\s+->\s+(\S+)$/);
    if (inlineMatch) {
      tokens.push({ type: 'COMPONENT', componentType: inlineMatch[1], inlineLabel: inlineMatch[2], inlineAction: inlineMatch[3], indent, line: lineNum });
      continue;
    }

    // Plain COMPONENT
    const compMatch = trimmed.match(/^(\w[\w-]*)$/);
    if (compMatch) {
      tokens.push({ type: 'COMPONENT', componentType: compMatch[1], indent, line: lineNum });
      continue;
    }
  }

  return tokens;
}
