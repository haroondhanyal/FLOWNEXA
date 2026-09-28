const ALLOWED_TAGS = new Set(["a", "b", "blockquote", "br", "code", "div", "em", "font", "h1", "h2", "h3", "hr", "i", "img", "li", "ol", "p", "pre", "s", "span", "strike", "strong", "table", "tbody", "td", "th", "thead", "tr", "u", "ul"]);
const DROP_CONTENT = /<(script|style|iframe|object|embed|svg|math|form|input|button|video|audio|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

// NOTES SECURITY: the editor accepts pasted HTML, so persist only formatting tags and safe link/image/style attributes.
export function sanitizeNoteHtml(input: string) {
  const withoutActiveContent = input.replace(/<!--[\s\S]*?-->/g, "").replace(DROP_CONTENT, "");
  return withoutActiveContent.replace(/<\/?([a-z][a-z0-9-]*)\b([^>]*)>/gi, (tag, rawName: string, rawAttributes: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (tag.startsWith("</")) return `</${name}>`;
    const attributes: string[] = [];
    const quotedAttribute = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    for (const match of rawAttributes.matchAll(quotedAttribute)) {
      const key = match[1].toLowerCase();
      const value = match[2] ?? match[3] ?? "";
      if (key === "href" && name === "a" && /^(https?:\/\/|mailto:)/i.test(value.trim())) attributes.push(`href="${escapeAttribute(value.trim())}"`);
      if (key === "src" && name === "img" && /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)) attributes.push(`src="${escapeAttribute(value)}"`);
      if (key === "alt" && name === "img") attributes.push(`alt="${escapeAttribute(value.slice(0, 200))}"`);
      if (key === "color" && name === "font" && /^#[\da-f]{3,8}$/i.test(value)) attributes.push(`color="${value}"`);
      if (key === "face" && name === "font" && /^[\w ,'-]{1,64}$/.test(value)) attributes.push(`face="${escapeAttribute(value)}"`);
      if (key === "style") {
        const safeStyle = value.split(";").map((rule) => rule.trim()).filter((rule) => /^(color|background-color|font-family|font-size|font-weight|font-style|text-align|text-decoration)\s*:\s*[#(),.%\w '"-]+$/i.test(rule) && !/(url|expression|javascript)/i.test(rule)).join(";");
        if (safeStyle) attributes.push(`style="${escapeAttribute(safeStyle)}"`);
      }
    }
    return `<${name}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
  });
}
function escapeAttribute(value: string) { return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
