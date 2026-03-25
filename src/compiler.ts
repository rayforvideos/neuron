import { readFileSync } from 'fs';
import { parse } from './parser';
import type { NeuronAST } from './ast';
import { generateHTML } from './generator/html';
import { generateCSS } from './generator/css';
import { generateJS } from './generator/js';
import { loadTheme } from './theme';

export interface CompileInput {
  appFile: string;
  pageFiles: string[];
  apiFiles: string[];
  themeFile: string | null;
  appTitle: string;
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

  // Load theme
  const theme = loadTheme(input.themeFile);

  // Generate outputs
  const html = generateHTML(ast.pages, input.appTitle);
  const css = generateCSS(theme);
  const js = generateJS(ast);

  return { html, css, js, errors };
}
