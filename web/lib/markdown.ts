// Conversor Markdown -> HTML minimo, sem dependencia externa. Escapa HTML antes
// (o conteudo vem do assistente e vai pra dangerouslySetInnerHTML).
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(s: string) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => "<code>" + c + "</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function mdToHtml(md: string): string {
  const lines = escapeHtml(md || "").split("\n");
  let html = "";
  let inCode = false;
  let codeBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listBuf: string[] = [];
  const flushList = () => {
    if (!listType) return;
    html += `<${listType}>` + listBuf.map((li) => "<li>" + inlineMd(li) + "</li>").join("") + `</${listType}>`;
    listType = null;
    listBuf = [];
  };
  for (const raw of lines) {
    if (raw.trim().match(/^```/)) {
      if (inCode) {
        html += "<pre><code>" + codeBuf.join("\n") + "</code></pre>";
        inCode = false;
        codeBuf = [];
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const n = h[1].length;
      html += `<h${n}>` + inlineMd(h[2]) + `</h${n}>`;
      continue;
    }
    const bq = raw.match(/^>\s?(.*)$/);
    if (bq) {
      flushList();
      html += "<blockquote>" + inlineMd(bq[1]) + "</blockquote>";
      continue;
    }
    const ol = raw.match(/^\s*\d+\.\s+(.*)$/);
    const ul = raw.match(/^\s*[-*]\s+(.*)$/);
    if (ol) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listBuf.push(ol[1]);
      continue;
    }
    if (ul) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listBuf.push(ul[1]);
      continue;
    }
    if (raw.trim() === "") {
      flushList();
      continue;
    }
    flushList();
    html += "<p>" + inlineMd(raw) + "</p>";
  }
  flushList();
  if (inCode) html += "<pre><code>" + codeBuf.join("\n") + "</code></pre>";
  return html;
}
