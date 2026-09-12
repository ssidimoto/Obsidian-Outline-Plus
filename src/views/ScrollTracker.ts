import { Component, EventRef, MarkdownView, Workspace, WorkspaceWindow } from "obsidian";
import { PREVIEW_SCROLLER_CLASS, asElement, getPreviewCenterLine, runWhenPreviewRendered } from "./PreviewScroll";

declare module "obsidian" {
    interface Workspace {
        /**
         * Internal API: fired whenever either mode of a markdown view scrolls, with the view
         * that scrolled. Obsidian's own outline core plugin is driven by this event.
         *
         * It also accounts for programmatic scrolls: scrolling the view from code suppresses
         * exactly one of these, which a raw DOM listener cannot know about.
         */
        on(name: "markdown-scroll", callback: (view: MarkdownView) => unknown, ctx?: unknown): EventRef;
    }
}

export interface ScrollTrackerOptions {
    /** Listeners are registered here, so they are removed when the owner unloads. */
    owner: Component;
    /** True when this view is the pane the outline mirrors. */
    owns: (view: MarkdownView) => boolean;
    /** The pane the outline mirrors, when no view is handed to us by an event. */
    currentView: () => MarkdownView | null;
    /** Centre line for a view in editing mode. */
    sourceLine: (view: MarkdownView) => number | null;
    /** Receives the zero-based line the user is reading. */
    onLine: (line: number) => void;
}

/** How long a scroll the plugin triggered itself can keep arriving after the jump. */
const SUPPRESS_MS = 400;

/**
 * Single source of "which line is the user looking at", for both editing and reading mode.
 *
 * Reading mode has no CodeMirror instance, so the editor's scroll handler never fires there
 * and the outline used to stop following the document entirely.
 */
export class ScrollTracker {
    private readonly workspace: Workspace;
    private readonly opts: ScrollTrackerOptions;

    private frame = 0;
    private pending: MarkdownView | null = null;
    private lastLine: number | null = null;
    private suppressUntil = 0;
    /** The internal event is authoritative; the fallbacks stand down once it arrives. */
    private sawInternalEvent = false;

    constructor(workspace: Workspace, opts: ScrollTrackerOptions) {
        this.workspace = workspace;
        this.opts = opts;
        this.register();
    }

    /** Ignores the scroll feedback caused by the plugin's own jump to a heading. */
    suppress(): void {
        this.suppressUntil = window.performance.now() + SUPPRESS_MS;
    }

    /** Forgets the last emitted line, so the next computation is emitted even if unchanged. */
    invalidate(): void {
        this.lastLine = null;
    }

    /** Queues a recompute for a view, subject to ownership and suppression. */
    schedule(view: MarkdownView): void {
        if (window.performance.now() < this.suppressUntil) return;
        if (!this.opts.owns(view)) return;

        this.pending = view;
        if (this.frame) return;

        this.frame = window.requestAnimationFrame(() => {
            this.frame = 0;
            const target = this.pending;
            this.pending = null;
            if (target) this.emit(target);
        });
    }

    /**
     * Recomputes the highlight for a view whose mode just changed.
     *
     * Switching mode restores the scroll position through the renderer, which deliberately
     * swallows the scroll event it causes, so the recompute has to be issued explicitly:
     * once now, and once more when the pending render settles and sections are measurable.
     */
    resync(view: MarkdownView): void {
        this.invalidate();
        this.schedule(view);

        if (view.getMode() === "preview") {
            runWhenPreviewRendered(view, () => {
                this.invalidate();
                this.schedule(view);
            });
        }
    }

    private register(): void {
        const owner = this.opts.owner;

        owner.registerEvent(
            this.workspace.on("markdown-scroll", (view: MarkdownView) => {
                this.sawInternalEvent = true;
                this.schedule(view);
            })
        );

        // Fallback for a build where the internal event is gone. Scroll events do not bubble,
        // but they are still dispatched through the capture phase, so one listener per
        // document covers every pane without ever having to be re-attached.
        const onDomScroll = (event: Event) => {
            if (this.sawInternalEvent) return;

            const target = asElement(event.target);
            if (!target) return;
            if (!target.hasClass(PREVIEW_SCROLLER_CLASS) && !target.hasClass("cm-scroller")) return;
            if (target.closest(".markdown-embed")) return; // nested embedded-note scroller

            const view = this.viewForScroller(target);
            if (view) this.schedule(view);
        };

        const options: AddEventListenerOptions = { capture: true, passive: true };
        owner.registerDomEvent(document, "scroll", onDomScroll, options);

        // Pop-out windows have their own document, which the listener above never sees.
        const popouts = new Map<Document, () => void>();
        owner.registerEvent(
            this.workspace.on("window-open", (_workspaceWindow: WorkspaceWindow, win: Window) => {
                const doc = win.document;
                doc.addEventListener("scroll", onDomScroll, options);
                popouts.set(doc, () => { doc.removeEventListener("scroll", onDomScroll, options); });
            })
        );
        owner.registerEvent(
            this.workspace.on("window-close", (_workspaceWindow: WorkspaceWindow, win: Window) => {
                popouts.get(win.document)?.();
                popouts.delete(win.document);
            })
        );

        // Resizing a pane moves the viewport centre without emitting a scroll event. Dragging
        // the sidebar divider is exactly that, and it focuses the sidebar, so the pane has to
        // be resolved the same way the rest of the plugin resolves it rather than from the
        // active leaf.
        owner.registerEvent(
            this.workspace.on("resize", () => {
                const view = this.opts.currentView();
                if (view) this.schedule(view);
            })
        );

        owner.register(() => {
            for (const off of popouts.values()) off();
            popouts.clear();

            if (this.frame) window.cancelAnimationFrame(this.frame);
            this.frame = 0;
            this.pending = null;
        });
    }

    private emit(view: MarkdownView): void {
        const line = view.getMode() === "preview"
            ? getPreviewCenterLine(view)
            : this.opts.sourceLine(view);

        if (line === null || line === this.lastLine) return;

        this.lastLine = line;
        this.opts.onLine(line);
    }

    private viewForScroller(target: HTMLElement): MarkdownView | null {
        for (const leaf of this.workspace.getLeavesOfType("markdown")) {
            const view = leaf.view;
            if (view instanceof MarkdownView && view.containerEl.contains(target)) return view;
        }
        return null;
    }
}
