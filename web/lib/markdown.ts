// Markdown -> HTML com parser de verdade (GFM: tabelas, listas, task lists,
// strikethrough, code fences...). A saida vai pra dangerouslySetInnerHTML, entao
// sanitizamos com DOMPurify no cliente.
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: true });

let hooked = false;
function ensureHook() {
  if (hooked || typeof window === "undefined") return;
  // links sempre abrem em nova aba
  DOMPurify.addHook("afterSanitizeAttributes", (node: any) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
  hooked = true;
}

export function mdToHtml(md: string): string {
  const html = marked.parse(md || "", { async: false }) as string;
  // no SSR nao ha DOM pro DOMPurify; nesses componentes o conteudo real so
  // aparece apos montar no cliente, entao a saida do servidor fica vazia.
  if (typeof window === "undefined") return html;
  ensureHook();
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
}
