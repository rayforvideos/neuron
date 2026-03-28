import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export function scaffold(projectName: string, targetDir: string, themePreset?: string): void {
  const projectDir = join(targetDir, projectName);
  const dirs = [
    projectDir,
    join(projectDir, 'pages'),
    join(projectDir, 'apis'),
    join(projectDir, 'components'),
    join(projectDir, 'themes'),
    join(projectDir, 'assets'),
    join(projectDir, 'logic'),
  ];
  for (const d of dirs) mkdirSync(d, { recursive: true });

  const templatesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

  const files: Array<{ src: string; dest: string }> = [
    { src: 'neuron.json', dest: 'neuron.json' },
    { src: 'app.neuron', dest: 'app.neuron' },
    { src: 'pages/home.neuron', dest: 'pages/home.neuron' },
  ];
  if (!themePreset) {
    files.push({ src: 'theme.json', dest: 'themes/theme.json' });
  }

  for (const file of files) {
    let content = readFileSync(join(templatesDir, file.src), 'utf-8');
    content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
    writeFileSync(join(projectDir, file.dest), content);
  }

  if (themePreset) {
    const neuronJsonPath = join(projectDir, 'neuron.json');
    const config = JSON.parse(readFileSync(neuronJsonPath, 'utf-8'));
    config.theme = themePreset;
    writeFileSync(neuronJsonPath, JSON.stringify(config, null, 2));
  }
}
