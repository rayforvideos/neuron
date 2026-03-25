import type { PageNode } from '../ast';
import { renderComponent } from '../components/registry';

export function generateHTML(pages: PageNode[], appTitle: string): string {
  const pagesSections = pages.map(page => {
    const componentsHtml = page.components.map(c => renderComponent(c)).join('\n    ');
    return `  <div class="neuron-page" data-page="${page.name}" data-route="${page.route}" style="display:none">
    ${componentsHtml}
  </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appTitle}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
${pagesSections}
  </div>
  <script src="main.js"></script>
</body>
</html>`;
}
