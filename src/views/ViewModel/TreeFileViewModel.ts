import { Heading, HtmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import FileTreeViewPlugin from "main";
import { Component, EditorPosition, EditorRange, MarkdownView, TFile, debounce, Editor } from "obsidian";
import { BehaviorSubject } from 'rxjs';
import { EditorView } from '@codemirror/view';
import { SETTINGS } from "../../main";
import { ScrollTracker } from "../ScrollTracker";
import { applyPreviewScroll } from "../PreviewScroll";

declare module "obsidian" {
  interface Editor {
    /** Internal API: the underlying CodeMirror view. */
    cm?: EditorView;
    /** Internal API: highlights the given ranges with the given style. */
    addHighlights(ranges: EditorRange[], style: string): void;
    /** Internal API: removes the highlights previously added with the given style. */
    removeHighlights(style?: string): void;
  }
}

export const maxHeadingDepth = 6;

export enum TreeAction {
  add,
  delete,
  destroy,
  nothing,
  scrolled,
  Error,
  update
}

export enum ParamUpdateAction {
  refreshRate,
  collapseDepth,
  manualUpdate,
  dynamicCollapseDepthDiff
}

export class TreeChange {
  action: TreeAction;
  node: HeadingNode<Heading> | null | number;
  constructor(action: TreeAction, node: HeadingNode<Heading> | null | number = null) {
    this.action = action;
    this.node = node;
  }
}

/**
 * View model that builds and manages a heading tree for the active file
 * using live Editor parsing for instantaneous updates.
 */
export class TreeFileViewModel {
  plugin: FileTreeViewPlugin;
  /**
   * Every listener is registered here rather than on the plugin, so closing the outline
   * pane takes them all with it. A second pane would otherwise stack a second full set,
   * re-parsing the document once more on every keystroke.
   */
  private owner: Component;
  tree!: HeadingsTree<Heading>;
  id: number = 1;
  fileName: string | null = null;
  private lastKnownFile: TFile | null = null;
  private lastParsedDoc: string = "";
  
  private change = new BehaviorSubject<TreeChange | null>(null);
  readonly change$ = this.change.asObservable();
  
  highlight: number = 0;
  nodeArr: (HeadingNode<Heading> | undefined)[] = [];
  hooveredNode: HeadingNode<HtmlHeading> | undefined = undefined;

  /** Follows the reading position in both editing and reading mode. */
  private scrollTracker!: ScrollTracker;

  /** Path of the note the outline currently mirrors, used to resolve relative links. */
  get sourcePath(): string {
    return this.lastKnownFile?.path ?? "";
  }

  // Debounce the live editor parsing to maintain high typing performance (150ms delay)
  private debouncedEditorSync = debounce((editor: Editor) => {
    this.syncTreeFromEditor(editor);
  }, 0, true);

  constructor(plugin: FileTreeViewPlugin, owner: Component) {
    this.plugin = plugin;
    this.owner = owner;
    this.init();
  }

  /** Initialize listeners and root tree. */
  init() {
    const rootHeading = new Heading("Tree File Structure", -1, 0);
    const root = new HeadingNode(rootHeading, 0, 0);
    this.tree = new HeadingsTree(root);
    //detect file closing even if not focus

  //listen with layout change and print some deug info
  this.owner.registerEvent(
    this.plugin.app.workspace.on('layout-change', () => {
      let view = this.getOutlineMarkdownView();
      //if view null means file got deleted
      if(view === null) {
        this.destroyTree();
        this.change.next(new TreeChange(TreeAction.Error));
      } else {
        // Covers toggling between editing and reading mode: the new mode has just been
        // laid out, so the highlight has to be recomputed from it.
        this.scrollTracker.resync(view);
      }

    })
  );
    // 1. Listen for active file change
    this.owner.registerEvent(
      this.plugin.app.workspace.on('file-open', (file: TFile | null) => {
        //get active mark down file
        let view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);

        if (file && view && view.file && file.basename == view.file.basename) {
          void this.handleFile(file);
        } else {
          this.destroyTree();
          this.change.next(new TreeChange(TreeAction.Error));
        }
      })
    );

    // 2. Listen for live editor changes (Instant UI!)
    this.owner.registerEvent(
      this.plugin.app.workspace.on('editor-change', (editor, info) => {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile && info?.file && info.file.path === activeFile.path && SETTINGS.manualUpdate === false) {
            this.lastKnownFile = info.file;
            this.debouncedEditorSync(editor);
            window.setTimeout(() => {
            }, SETTINGS.refreshRate); // Refresh rate is handled by the debounce function
        }
      })
    );

    // 3. Follow the reading position. Obsidian reports scrolling for both modes through a
    // single workspace event, which also tells us which pane scrolled and stays silent for
    // the scrolls this plugin causes itself.
    this.scrollTracker = new ScrollTracker(this.plugin.app.workspace, {
        owner: this.owner,
        owns: (view) => {
            const tracked = this.lastKnownFile?.path;
            return tracked === undefined || view.file?.path === tracked;
        },
        currentView: () => this.getOutlineMarkdownView(),
        sourceLine: (view) => this.editorCenterLine(view),
        onLine: (line) => { this.change.next(new TreeChange(TreeAction.scrolled, line)); },
    });

    //load params from lcoalstorage and load them into defautl params
    const savedSettings = this.plugin.app.loadLocalStorage('fileTreeSettings') as Partial<typeof SETTINGS> | null;
    if (savedSettings) {
        Object.assign(SETTINGS, savedSettings);
    }

    //store current data parameters when app is closed
    this.owner.registerEvent(
        this.plugin.app.workspace.on('quit', () => {
            this.plugin.app.saveLocalStorage('fileTreeSettings', SETTINGS);
        })
    );

    if(!this.lastKnownFile) {
      this.change.next(new TreeChange(TreeAction.Error));
    }
  }

  /**
   * Centre line of a view in editing mode, or null when its editor is not laid out.
   *
   * A background tab holding the same file has a zero-height editor: every measurement
   * would come back as zero and report line 0, snapping the highlight to the first heading.
   */
  private editorCenterLine(view: MarkdownView): number | null {
    const editor = view.editor;
    const cm = editor?.cm;
    if (!editor || !cm || cm.scrollDOM.clientHeight === 0) return null;

    return this.getExactCenterLine(editor, true);
  }

  /**
   * The markdown view the outline mirrors.
   *
   * `getActiveViewOfType` only looks at the active leaf, so it returns null as soon as the
   * focus moves to the outline's own sidebar leaf. The active file is resolved across all
   * leaves, so it is used to find the pane again before concluding the file is gone.
   */
  private getOutlineMarkdownView(): MarkdownView | null {
    const workspace = this.plugin.app.workspace;

    const active = workspace.getActiveViewOfType(MarkdownView);
    if (active) return active;

    const file = workspace.getActiveFile();
    if (!file) return null;

    for (const leaf of workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === file.path) return view;
    }

    return null;
  }

  onChange(action: ParamUpdateAction, val: number) {
    switch (action) {
      case ParamUpdateAction.refreshRate:
        SETTINGS.refreshRate = val;
        break;
      case ParamUpdateAction.collapseDepth:
        SETTINGS.collapseDepth = val;
        break;
      case ParamUpdateAction.manualUpdate:
        SETTINGS.manualUpdate = val !== 0;
        break;
      case ParamUpdateAction.dynamicCollapseDepthDiff:
        SETTINGS.dynamicCollapseDepthDiff = val;
        break;
    }
  }

  /** Rebuild tree from the currently active file, if any. */
  refreshTree() {

    if (this.lastKnownFile) {
      void this.handleFile(this.lastKnownFile);
      return;
    }
  }

  /** Reset tree on file switch */
  private async handleFile(file: TFile) {
    this.lastKnownFile = file;
    this.fileName = file.basename;
    this.tree.root.childrens = [];
    this.nodeArr = [];
    this.id = 1;

    this.destroyTree();
    void this.syncTreeFromFile(file);
  }

  destroyTree() {
    this.tree.root.childrens = [];
    this.nodeArr = [];
    this.id = 1;
    this.change.next(new TreeChange(TreeAction.destroy));
  }

  
  private syncTreeFromEditor(editor: Editor) {
    const doc = editor.getValue();
    this.lastParsedDoc = doc;
    const cmView = editor.cm;
    const totalLines = editor.lineCount();

    const HEADING_REGEX = /^#{1,6}\s+(.*)$/gm;

    const newHeadingsData: { text: string; level: number; lineNbr: number; width: number }[] = [];
    let match: RegExpExecArray | null;

    while ((match = HEADING_REGEX.exec(doc)) !== null) {
      const charOffset = match.index;
      const fullMatch = match[0];
      const headingText = match[1] ? match[1].trim() : "";

      let level = 0;
      while (fullMatch[level] === "#") {
        level++;
      }

      let lineNbr = 0;
      if (cmView) {
        lineNbr = cmView.state.doc.lineAt(charOffset).number - 1;
      } else {
        lineNbr = editor.offsetToPos(charOffset).line;
      }

      newHeadingsData.push({ level, text: headingText, lineNbr, width: 0 });
    }

    for (let i = 0; i < newHeadingsData.length; i++) {
      const current = newHeadingsData[i]!;
      const next = newHeadingsData[i + 1];
      current.width = next ? next.lineNbr - current.lineNbr : totalLines - current.lineNbr;
    }

    this.applyHeadingsData(newHeadingsData);
  }

  private async syncTreeFromFile(file: TFile) {
    const doc = await this.plugin.app.vault.cachedRead(file);
    this.lastParsedDoc = doc;
    this.applyHeadingsData(this.parseHeadingsFromText(doc));

    // The tree only exists now, so a file opened straight into reading mode would otherwise
    // show no highlight until the first scroll.
    const view = this.getOutlineMarkdownView();
    if (view) this.scrollTracker.resync(view);
  }

  private parseHeadingsFromText(doc: string): { text: string; level: number; lineNbr: number; width: number }[] {
    const headings: { text: string; level: number; lineNbr: number; width: number }[] = [];
    const headingRegex = /^(#{1,6})[ \t]+(.*)$/gm;

    let currentLine = 0;
    let lastMatchIndex = 0;
    let match: RegExpExecArray | null;

    // Single pass regex match across the entire document
    while ((match = headingRegex.exec(doc)) !== null) {
      const matchIndex = match.index;

      // Count newlines between last match position and current match position
      for (let i = lastMatchIndex; i < matchIndex; i++) {
        if (doc.charCodeAt(i) === 10) { // 10 is ASCII for '\n'
          currentLine++;
        }
      }
      lastMatchIndex = matchIndex;

      headings.push({
        level: match[1]!.length,
        text: match[2]!.trim(),
        lineNbr: currentLine,
        width: 0,
      });
    }

    if (headings.length === 0) return headings;

    // Count remaining lines to compute the total document line count
    for (let i = lastMatchIndex; i < doc.length; i++) {
      if (doc.charCodeAt(i) === 10) {
        currentLine++;
      }
    }
    const totalLines = currentLine + 1;

    // Calculate width (line span) for each heading
    for (let i = 0; i < headings.length; i++) {
      const current = headings[i]!;
      const next = headings[i + 1];
      current.width = next ? next.lineNbr - current.lineNbr : totalLines - current.lineNbr;
    }

    return headings;
  }

  private applyHeadingsData(newHeadingsData: { text: string; level: number; lineNbr: number; width: number }[]) {

    // --- Diffing Logic (Runs in O(H) where H = number of headings) ---
    const oldNodes = this.nodeArr.filter((n): n is HeadingNode<Heading> => n !== undefined);

    const oldMap = new Map<string, HeadingNode<Heading>>();
    const counts = new Map<string, number>();

    oldNodes.forEach((node) => {
      const baseKey = `${node.depth}:${node.data.headLine}`;
      const count = (counts.get(baseKey) || 0) + 1;
      counts.set(baseKey, count);
      oldMap.set(`${baseKey}:${count}`, node);
    });

    const newMap = new Map<string, (typeof newHeadingsData)[0]>();
    counts.clear();

    newHeadingsData.forEach((item) => {
      const baseKey = `${item.level}:${item.text}`;
      const count = (counts.get(baseKey) || 0) + 1;
      counts.set(baseKey, count);
      newMap.set(`${baseKey}:${count}`, item);
    });

    // 1. Delete removed nodes & update moved line numbers without recreating elements
    for (const [key, oldNode] of oldMap.entries()) {
      if (!newMap.has(key)) {
        this.tree.removeNode(oldNode);

        this.nodeArr[oldNode.id] = undefined;
        this.change.next(new TreeChange(TreeAction.delete, oldNode.id));
      } else {
        const newItem = newMap.get(key)!;
        if (oldNode.data.lineNbr !== newItem.lineNbr || oldNode.data.width !== newItem.width) {
            oldNode.data.lineNbr = newItem.lineNbr;
            oldNode.data.width = newItem.width;
            this.change.next(new TreeChange(TreeAction.update, oldNode));
        }
      }
    }

    // 2. Add new nodes
    for (const [key, newItem] of newMap.entries()) {
      if (!oldMap.has(key)) {
        const heading = new Heading(newItem.text, newItem.lineNbr, newItem.width);
        const newNode = new HeadingNode<Heading>(heading, newItem.level, this.getId());
        this.nodeArr[newNode.id] = newNode;
        this.tree.addNode(newNode);
        this.change.next(new TreeChange(TreeAction.add, newNode));
      }
    }
  }

  /** Incremental ID generator */
  getId(): number {
    return this.id++;
  }

  /** Scrolling execution when heading clicked */
  async OnHeadingClicked(id: number) {
    const node = this.nodeArr[id];
    const markdownView = this.getOutlineMarkdownView();

    // The root row carries id 0 and has no heading behind it, and a node can be dropped by a
    // concurrent re-parse: neither is an error, there is simply nowhere to scroll to.
    if (node === undefined || markdownView === null) {
      return;
    }

    // The jump scrolls the note, which would otherwise be reported straight back and move
    // the highlight around mid-flight. The target is known, so it is applied directly.
    this.scrollTracker.suppress();
    this.scrollTracker.invalidate();

    if (markdownView.getMode() === "preview") {
      applyPreviewScroll(markdownView, node.data.lineNbr);

      this.change.next(new TreeChange(TreeAction.scrolled, node.data.lineNbr));
    } else {
      const editor = markdownView.editor;
      const startPos: EditorPosition = { line: node.data.lineNbr, ch: 0 };
      const endCh = editor.getLine(node.data.lineNbr).length;
      const endPos: EditorPosition = { line: node.data.lineNbr, ch: endCh };

      const ranges = [{ from: startPos, to: endPos }];

      editor.scrollIntoView({ from: startPos, to: endPos }, true);

      if (this.highlight > 0) {
        editor.removeHighlights(undefined);
      }

      editor.addHighlights(ranges, "is-flashing");
      this.highlight += 1;

      window.setTimeout(() => {
        if (this.highlight === 1) {
          editor.removeHighlights(undefined);
          this.highlight = 0;
        } else {
          this.highlight -= 1;
        }
      }, 3000);

      this.change.next(new TreeChange(TreeAction.scrolled, node.data.lineNbr));
    }
  }

  getExactCenterLine(editor: Editor | EditorView, zeroBased: boolean = true): number {
      const cmView = editor instanceof EditorView ? editor : editor.cm;
      if (!cmView) return (editor as Editor).getCursor().line;

      const scroller = cmView.scrollDOM;

      // `lineBlockAtHeight` measures from the top of the *content*, while `scrollTop`
      // measures from the top of the *scroller*. Everything the editor puts above the first
      // line — the inline title and the properties block — sits between the two, so the
      // offset has to come out or every reported line is too far down the document.
      const contentTop = cmView.contentDOM.offsetTop;
      const midY = Math.max(0, scroller.scrollTop - contentTop + scroller.clientHeight / 2);

      const pos = cmView.lineBlockAtHeight(midY).from;
      const line1Based = cmView.state.doc.lineAt(pos).number;

      return zeroBased ? line1Based - 1 : line1Based;
  }
}
