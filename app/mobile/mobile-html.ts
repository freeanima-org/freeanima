/** shell-bridge 先于主 bundle 在 body 末尾执行；资源用相对路径 */
export function arrangeMobileIndexHtml(html: string): string {
  const mainScriptRe =
    /<script type="module" crossorigin src="(\.\/(?:assets\/)?[^"]+\.js)"><\/script>\s*/;
  const match = html.match(mainScriptRe);
  const bridgeTag = `<script type="module" crossorigin src="./shell-bridge.js"></script>`;

  if (!match) {
    if (html.includes("shell-bridge.js")) return html;
    return html.replace("</body>", `    ${bridgeTag}\n  </body>`);
  }

  const mainScriptTag = match[0].trimEnd();
  const withoutMain = html.replace(mainScriptRe, "");
  if (withoutMain.includes("shell-bridge.js")) {
    return withoutMain.replace("</body>", `    ${mainScriptTag}\n  </body>`);
  }
  return withoutMain.replace("</body>", `    ${bridgeTag}\n    ${mainScriptTag}\n  </body>`);
}
