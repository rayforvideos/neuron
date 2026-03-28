import type { PageNode, ComponentNode } from '../ast';
import { renderComponent } from '../components/registry';

let _showIfCounter = 0;

function wrapWithShowIf(html: string, comp: ComponentNode): string {
  if (!comp.showIf) return html;
  const id = `neuron-sf-${_showIfCounter++}`;
  return `<div id="${id}" data-show-if="${comp.showIf.negate ? '!' : ''}${comp.showIf.field}">${html}</div>`;
}

export function generateHTML(pages: PageNode[], appTitle: string, devMode?: boolean): string {
  _showIfCounter = 0;
  const devScript = devMode ? `
  <script>
  (function() {
    var ws = new WebSocket('ws://' + location.host);
    ws.onmessage = function(e) {
      if (e.data === 'reload') location.reload();
    };
    ws.onclose = function() {
      setTimeout(function() { location.reload(); }, 1000);
    };
  })();
  </script>` : '';
  const pagesSections = pages.map(page => {
    const componentsHtml = page.components.map(c => {
      const html = renderComponent(c);
      return wrapWithShowIf(html, c);
    }).join('\n    ');
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
  <script src="main.js"></script>${devScript}
</body>
</html>`;
}
