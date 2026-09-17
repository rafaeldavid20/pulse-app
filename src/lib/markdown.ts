function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url: string): string {
  const trimmed = url.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : '#';
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
      return `<a href="${safeUrl(url)}" target="_blank" rel="noreferrer">${label}</a>`;
    });
}

/**
 * Subconjunto de Markdown para descripciones de issues: encabezados, negrita,
 * itálica, código, listas y links. No es un parser completo (sin tablas ni HTML
 * embebido) — alcanza para lo que el panel necesita sin sumar una dependencia,
 * y como todo el texto se escapa antes de aplicar las reglas, no hay forma de
 * inyectar HTML desde la descripción de un issue.
 */
export function markdownToHtml(source: string): string {
  if (!source.trim()) return '';

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    html.push(`<p>${paragraphBuffer.join('<br/>')}</p>`);
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    html.push(`<ul>${listBuffer.join('')}</ul>`);
    listBuffer = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(escapeHtml(line));
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (listItem) {
      flushParagraph();
      listBuffer.push(`<li>${inline(listItem[1])}</li>`);
      continue;
    }
    flushList();

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    paragraphBuffer.push(inline(line));
  }

  flushParagraph();
  flushList();
  if (inCodeBlock && codeBuffer.length > 0) {
    html.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
  }

  return html.join('\n');
}
