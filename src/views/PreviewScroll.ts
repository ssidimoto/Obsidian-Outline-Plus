import { MarkdownView } from "obsidian";

/**
 * One top-level rendered block of reading mode.
 *
 * Internal API: the preview renderer is not declared in obsidian.d.ts, so every field is
 * optional and every access is guarded. `start.line` is zero-based, matching the line
 * numbers the rest of the plugin works with.
 */
interface PreviewSection {
    el?: HTMLElement | null;
    start?: { line?: number } | null;
}

interface PreviewRenderer {
    previewEl?: HTMLElement | null;
    sections?: PreviewSection[];
    /** Runs the callback once the pending render settles, or immediately when idle. */
    onRendered?: (callback: () => void) => void;
    /** Two-argument form: the public `applyScroll` can neither centre nor flash. */
    applyScroll?: (line: number, options?: { center?: boolean; highlight?: boolean }) => boolean;
}

declare module "obsidian" {
    interface MarkdownPreviewView {
        /** Internal API: the renderer owning the scroll container and the section list. */
        renderer?: PreviewRenderer;
    }
}

/** Class Obsidian puts on the reading-mode scroll container. */
export const PREVIEW_SCROLLER_CLASS = "markdown-preview-view";

/**
 * Narrows a value of unknown provenance to an element.
 *
 * `instanceof HTMLElement` compares against one window's constructor, so it is false for
 * anything living in a pop-out window. Node types are realm-independent, so they are what
 * this checks.
 */
export function asElement(value: unknown): HTMLElement | null {
    if (!value || typeof value !== "object") return null;
    const node = value as Node;
    return node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null;
}

/**
 * The preview renderer, or null when it is absent or does not have the shape this module
 * relies on. Every caller has a public-API path for the null case.
 */
function getPreviewRenderer(view: MarkdownView): PreviewRenderer | null {
    const renderer = view.previewMode.renderer;
    if (!renderer || typeof renderer !== "object") return null;
    if (!asElement(renderer.previewEl)) return null;
    if (!Array.isArray(renderer.sections)) return null;
    return renderer;
}

/**
 * The scrollable element of a view's reading mode.
 *
 * Public fallback: `previewMode.containerEl` is the reading-mode host, whose direct child is
 * the scroller. Direct child only — an embedded note renders its own scroller with the same
 * class further down the tree.
 */
export function getPreviewScroller(view: MarkdownView): HTMLElement | null {
    const previewEl = asElement(getPreviewRenderer(view)?.previewEl);
    if (previewEl) return previewEl;

    for (const child of Array.from(view.previewMode.containerEl.children)) {
        if (child.instanceOf(HTMLElement) && child.hasClass(PREVIEW_SCROLLER_CLASS)) return child;
    }
    return null;
}

/**
 * Runs `callback` once reading mode has finished the render it is in the middle of.
 *
 * Switching into reading mode restores the scroll position through the renderer, and the
 * sections are only measurable after that settles.
 *
 * Public fallback: reading mode also drops scroll events for a moment after a render, so the
 * callback is simply retried across that window.
 */
export function runWhenPreviewRendered(view: MarkdownView, callback: () => void): void {
    const onRendered = getPreviewRenderer(view)?.onRendered;
    if (typeof onRendered === "function") {
        onRendered(callback);
        return;
    }

    window.setTimeout(callback, 60);
    window.setTimeout(callback, 300);
}

/**
 * Scrolls a view's reading mode to `line`, centring and flashing it.
 *
 * Public fallback: `previewMode.applyScroll` puts the line at the top of the viewport and
 * cannot flash it. The internal form also reports failure — it refuses while the rendered
 * text is stale — in which case the public one is used instead.
 */
export function applyPreviewScroll(view: MarkdownView, line: number): void {
    const renderer = getPreviewRenderer(view);
    const applyScroll = renderer?.applyScroll;

    if (renderer && typeof applyScroll === "function") {
        if (applyScroll.call(renderer, line, { center: true, highlight: true })) return;
    }

    view.previewMode.applyScroll(line);
}

/** Last attached section that starts at or above `viewportY`. */
function sectionLineAbove(renderer: PreviewRenderer, viewportY: number): number | null {
    const sections = renderer.sections;
    if (!sections) return null;

    let found: number | null = null;

    for (const section of sections) {
        const el = asElement(section?.el);
        if (!el || !el.isConnected) continue;
        if (el.getBoundingClientRect().top > viewportY) break;

        const line = section.start?.line;
        if (typeof line === "number") found = line;
    }

    return found;
}

/**
 * Zero-based source line of the block at the vertical centre of a view's reading-mode
 * viewport, or null when it cannot be determined.
 *
 * Reading mode keeps only the viewport and a margin around it attached to the DOM, and
 * physically detaches the rest rather than hiding it. That window always covers the centre,
 * so measuring the attached sections is both correct and cheap. Detached sections are
 * skipped instead of ending the walk, because the attached ones stay contiguous and in
 * document order.
 *
 * The centre — rather than the top — mirrors what the editor path does, so both modes
 * highlight the same heading, and so clicking an entry (which centres its target) lands back
 * on the heading it scrolled to.
 */
export function getPreviewCenterLine(view: MarkdownView): number | null {
    const renderer = getPreviewRenderer(view);
    const scroller = asElement(renderer?.previewEl) ?? getPreviewScroller(view);

    // Reading mode is hidden while the editor is showing: every rect would be zero, and the
    // centre would resolve to the end of the document.
    if (!scroller || scroller.clientHeight === 0) return null;

    if (renderer) {
        const rect = scroller.getBoundingClientRect();
        const line = sectionLineAbove(renderer, rect.top + rect.height / 2);
        if (line !== null) return line;
    }

    // Public fallback: the first line of the viewport rather than its centre — the semantics
    // Obsidian's own outline uses. Declared as `number`, but it is null until the sections
    // have been measured.
    const top: unknown = view.previewMode.getScroll();
    if (typeof top === "number" && Number.isFinite(top)) return Math.max(0, Math.floor(top));

    return null;
}
