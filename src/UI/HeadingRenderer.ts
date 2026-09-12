import { App, Component, MarkdownRenderer } from "obsidian";

/**
 * A heading's text arrives without its leading "#", but it can still *start* with a block
 * marker — "1. Introduction", "- Overview", "> Note", "---" — which the parser would turn
 * into a list, a quote or a horizontal rule instead of a paragraph. Escaping just the marker
 * keeps the parser in inline mode without changing a single visible character, since `\.`,
 * `\-`, `\>` and `\#` are punctuation escapes that render as themselves.
 *
 * Embeds are demoted to plain links on the same principle: `![[Note]]` would otherwise pull
 * a whole document into a twenty-pixel row.
 */
export function toInlineSource(text: string): string {
    let source = text;

    source = source.replace(/^(\s*)(#{1,6})(?=\s|$)/, "$1\\$2");
    source = source.replace(/^(\s*)([-*+])(?=\s|$)/, "$1\\$2");
    source = source.replace(/^(\s*)(\d{1,9})([.)])(?=\s|$)/, "$1$2\\$3");
    source = source.replace(/^(\s*)(>)/, "$1\\$2");
    source = source.replace(/^(\s*)([`~]{3,})/, "$1\\$2");

    // A line made only of repeated -, * or _ is a thematic break.
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(source)) {
        source = source.replace(/([-*_])/, "\\$1");
    }

    return source.replace(/!(?=\[)/g, "\\!");
}

/**
 * Lifts the children of a lone `<p>` so the row stays a single inline flow.
 *
 * One line of inline Markdown always comes back wrapped in exactly one paragraph; anything
 * else (a table, a callout, a block of raw HTML) is left alone and flattened by CSS.
 */
function unwrapSingleParagraph(el: HTMLElement): void {
    if (el.childNodes.length !== 1) return;

    const only = el.firstChild;
    if (!(only instanceof HTMLParagraphElement)) return;

    const fragment = createFragment();
    while (only.firstChild) fragment.appendChild(only.firstChild);
    only.replaceWith(fragment);
}

/**
 * Renders one heading's Markdown — inline HTML, emphasis, wikilinks, tags, highlights and
 * LaTeX — into a single-line outline row, and returns the component that owns whatever the
 * render spawned. The caller must retire that component when the row goes away.
 *
 * The renderer appends its DOM synchronously; the promise only covers asynchronous
 * post-processing such as MathJax typesetting. So the row is never briefly blank, and two
 * renders of the same element cannot interleave as long as clearing and rendering stay in
 * one synchronous block. The promise can still reject, because third-party post-processors
 * run over this content too, so it is caught and the raw text is kept as a last resort.
 */
export function renderHeadingTitle(
    containerEl: HTMLElement,
    titleText: string,
    app: App,
    sourcePath: string,
    owner: Component
): Component | null {
    containerEl.empty();
    if (!titleText) return null;

    // Owns every child a post-processor registers for this row. `owner` is the loaded
    // outline view, so adopting the scope also loads it.
    const scope = new Component();
    owner.addChild(scope);

    let rendered: Promise<void>;
    try {
        rendered = MarkdownRenderer.render(app, toInlineSource(titleText), containerEl, sourcePath, scope);
    } catch {
        containerEl.setText(titleText); // a row must never be left blank
        return scope;
    }

    unwrapSingleParagraph(containerEl); // the content is already in the DOM here

    void rendered
        .then(() => { unwrapSingleParagraph(containerEl); })
        .catch(() => {
            if (containerEl.childNodes.length === 0) containerEl.setText(titleText);
        });

    return scope;
}
