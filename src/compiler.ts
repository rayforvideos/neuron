import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { parse } from './parser';
import type { NeuronAST } from './ast';
import { generateHTML } from './generator/html';
import { generateCSS } from './generator/css';
import { generateJS } from './generator/js';
import { loadTheme } from './theme';
import { NeuronError, formatError } from './errors';
import { validate } from './validator';
import { registerCustomComponent, clearCustomComponents, KNOWN_COMPONENTS } from './components/registry';

export interface CompileInput {
  appFile: string;
  pageFiles: string[];
  apiFiles: string[];
  themeFile: string | null;
  appTitle: string;
  devMode?: boolean;
}

export interface CompileResult {
  html: string;
  css: string;
  js: string;
  errors: string[];
}

export function compile(input: CompileInput): CompileResult {
  const errors: string[] = [];
  const ast: NeuronAST = { states: [], actions: [], apis: [], pages: [] };

  // Parse app.neuron (STATE + ACTION)
  try {
    const appSource = readFileSync(input.appFile, 'utf-8');
    const appAst = parse(appSource);
    ast.states.push(...appAst.states);
    ast.actions.push(...appAst.actions);
  } catch (err) {
    errors.push(`Failed to parse app.neuron: ${err}`);
  }

  // Parse page files
  for (const pageFile of input.pageFiles) {
    try {
      const source = readFileSync(pageFile, 'utf-8');
      const pageAst = parse(source);
      ast.pages.push(...pageAst.pages);
    } catch (err) {
      errors.push(`Failed to parse ${pageFile}: ${err}`);
    }
  }

  // Parse API files
  for (const apiFile of input.apiFiles) {
    try {
      const source = readFileSync(apiFile, 'utf-8');
      const apiAst = parse(source);
      ast.apis.push(...apiAst.apis);
    } catch (err) {
      errors.push(`Failed to parse ${apiFile}: ${err}`);
    }
  }

  // Scan logic/ directory
  const logicFiles: Record<string, string> = {};
  const projectDir = dirname(input.appFile);

  // Load theme (preset or file)
  let presetName: string | undefined;
  const neuronJsonPath = join(projectDir, 'neuron.json');
  if (existsSync(neuronJsonPath)) {
    try {
      const config = JSON.parse(readFileSync(neuronJsonPath, 'utf-8'));
      if (config.theme) presetName = config.theme;
    } catch {}
  }
  const theme = loadTheme(input.themeFile, presetName);
  // Scan components/ directory
  clearCustomComponents();
  let customCSS = '';
  const componentsDir = join(projectDir, 'components');
  if (existsSync(componentsDir)) {
    const htmlFiles = readdirSync(componentsDir).filter(f => f.endsWith('.html'));
    for (const file of htmlFiles) {
      const name = file.replace('.html', '');
      if (KNOWN_COMPONENTS.includes(name)) {
        errors.push(formatError(new NeuronError('component_name_conflict', name, {})));
        continue;
      }
      const template = readFileSync(join(componentsDir, file), 'utf-8');
      registerCustomComponent(name, template);

      const cssFile = join(componentsDir, name + '.css');
      if (existsSync(cssFile)) {
        customCSS += readFileSync(cssFile, 'utf-8') + '\n';
      }
    }
  }

  const logicDir = join(projectDir, 'logic');
  if (existsSync(logicDir)) {
    const jsFiles = readdirSync(logicDir).filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
      logicFiles[`logic/${file}`] = readFileSync(join(logicDir, file), 'utf-8');
    }
  }

  // Validate use: references
  for (const action of ast.actions) {
    for (const step of action.steps) {
      if (step.key === 'use') {
        const val = step.value.trim();
        const lastDot = val.lastIndexOf('.');
        const filePath = val.slice(0, lastDot) + '.js';
        if (!logicFiles[filePath]) {
          errors.push(formatError(new NeuronError('logic_file_not_found', filePath, {})));
        }
      }
    }
  }

  // Validate AST
  const validationErrors = validate(ast);
  errors.push(...validationErrors);

  // Generate outputs
  const html = generateHTML(ast.pages, input.appTitle, input.devMode);
  const css = generateCSS(theme, customCSS || undefined);
  const js = generateJS(ast, logicFiles, theme.transition || 'none');

  return { html, css, js, errors };
}
