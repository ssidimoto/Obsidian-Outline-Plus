import { Heading, HtmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import FileTreeViewPlugin from "main";
import { EditorPosition, MarkdownView, TFile, debounce, Editor } from "obsidian";
import { BehaviorSubject } from 'rxjs';
import { EditorView } from '@codemirror/view';
import { ParametersData } from "./ParametersViewModel";
import { DEFAULT_SETTINGS } from "global";

export const maxHeadingDepth = 6;

export enum TreeAction {
  add,
  delete,
  destroy,
  nothing,
  scrolled
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
  tree!: HeadingsTree<Heading>;
  id: number = 1;
  fileName: string | null = null;
  private lastKnownFile: TFile | null = null;
  private lastParsedDoc: string = "";
  parameters: ParametersData = new ParametersData(
    DEFAULT_SETTINGS.collapseDepth,
    DEFAULT_SETTINGS.refreshRate,
    DEFAULT_SETTINGS.manualUpdate,
    DEFAULT_SETTINGS.dynamicCollapseDepthDiff
  );
  
  private change = new BehaviorSubject<TreeChange | null>(null);
  readonly change$ = this.change.asObservable();
  
  highlight: number = 0;
  nodeArr: HeadingNode<Heading>[] = [];
  hooveredNode: HeadingNode<HtmlHeading> | undefined = undefined;

  // Debounce the live editor parsing to maintain high typing performance (150ms delay)
  private debouncedEditorSync = debounce((editor: Editor) => {
    this.syncTreeFromEditor(editor);
  }, 0, true);

  constructor(plugin: FileTreeViewPlugin) {
    this.plugin = plugin;
    this.init();
    void this.loadParameters();
  }

  async onParametersChange(updatedData: ParametersData) {
    this.parameters.collapseDepth = Number.isFinite(updatedData.collapseDepth)
      ? updatedData.collapseDepth
      : this.parameters.collapseDepth;
    this.parameters.refreshRate = Number.isFinite(updatedData.refreshRate)
      ? updatedData.refreshRate
      : this.parameters.refreshRate;
    this.parameters.manualUpdate = !!updatedData.manualUpdate;
    this.parameters.dynamicCollapseDepthDiff = Number.isFinite(updatedData.dynamicCollapseDepthDiff)
      ? updatedData.dynamicCollapseDepthDiff
      : this.parameters.dynamicCollapseDepthDiff;

    await this.persistParameters();
  }

  private async loadParameters() {
    const stored = await this.plugin.loadData();
    const raw = stored?.parameters;
    if (!raw || typeof raw !== "object") return;

    this.parameters.collapseDepth = this.asNumber(raw.collapseDepth, this.parameters.collapseDepth);
    this.parameters.refreshRate = this.asNumber(raw.refreshRate, this.parameters.refreshRate);
    this.parameters.manualUpdate = this.asBoolean(raw.manualUpdate, this.parameters.manualUpdate);
    this.parameters.dynamicCollapseDepthDiff = this.asNumber(
      raw.dynamicCollapseDepthDiff,
      this.parameters.dynamicCollapseDepthDiff
    );
  }

  private async persistParameters() {
    const data = (await this.plugin.loadData()) ?? {};
    data.parameters = {
      collapseDepth: this.parameters.collapseDepth,
      refreshRate: this.parameters.refreshRate,
      manualUpdate: this.parameters.manualUpdate,
      dynamicCollapseDepthDiff: this.parameters.dynamicCollapseDepthDiff,
    };
    await this.plugin.saveData(data);
  }

  private asNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
  }

  /** Initialize listeners and root tree. */
  init() {
    const rootHeading = new Heading("Tree File Structure", -1, 0);
    const root = new HeadingNode(rootHeading, 0, 0);
    this.tree = new HeadingsTree(root);

    // 1. Listen for active file change
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile && this.fileName !== activeFile.basename) {
          this.handleFileSwitch(activeFile);
        }
      })
    );

    // 2. Listen for live editor changes (Instant UI!)
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('editor-change', (editor, info) => {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile && info?.file && info.file.path === activeFile.path) {
            this.lastKnownFile = info.file;
            this.debouncedEditorSync(editor);
        }
      })
    );

    // 3. Listen for scroll events in CodeMirror
    this.plugin.registerEditorExtension(
        EditorView.domEventHandlers({
            scroll: (event, cmView) => {
                this.onEditorScroll(cmView);
            }
        })
    );
  }

  private onEditorScroll(editor: Editor | EditorView) {
    const centerLine = this.getExactCenterLine(editor, true);
    this.change.next({
        action: TreeAction.scrolled,
        node: centerLine
    });
  }

  /** Rebuild tree from the currently active file, if any. */
  refreshTree() {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    const fileToRefresh = activeFile ?? this.lastKnownFile;

    if (fileToRefresh) {
      void this.handleFileSwitch(fileToRefresh);
      return;
    }

    // Last-resort fallback for view-only refresh: rebuild from the last parsed snapshot.
    if (this.lastParsedDoc.length > 0) {
      this.tree.root.childrens = [];
      this.nodeArr = [];
      this.id = 1;
      this.change.next(new TreeChange(TreeAction.destroy));
      this.applyHeadingsData(this.parseHeadingsFromText(this.lastParsedDoc));
    }
  }

  // Backward-compatible alias kept for existing call sites.
  destroyTree() {
    this.refreshTree();
  }

  /** Reset tree on file switch */
  private async handleFileSwitch(file: TFile) {
    this.lastKnownFile = file;
    this.fileName = file.basename;
    this.tree.root.childrens = [];
    this.nodeArr = [];
    this.id = 1;

    this.change.next(new TreeChange(TreeAction.destroy));

    // Initialize with current file content
    const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.file?.path === file.path) {
        this.syncTreeFromEditor(activeView.editor);
    } else {
      // wait a bit and retry editor path, then fall back to cached file content
      setTimeout(async () => {
            const activeViewRetry = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeViewRetry && activeViewRetry.file?.path === file.path) {
                this.syncTreeFromEditor(activeViewRetry.editor);
          return;
            }

        await this.syncTreeFromFile(file);
        }, 100);
    }
  }

  /**
   * REFACTORED CORE LOGIC: Replaces ParseNewDoc & DocDiffRange.
   * Parses the text instantly and diffs it efficiently to avoid bugs with offset tracking.
   */
  /**
   * Ultra-fast parser optimized for massive files (10k-50k+ lines).
   * Operates directly on raw text using regex scanning and CodeMirror's line tree.
   */
  private syncTreeFromEditor(editor: Editor) {
    const doc = editor.getValue();
    this.lastParsedDoc = doc;
    const cmView = (editor as any).cm as EditorView | undefined;
    const totalLines = editor.lineCount();

    // Global multiline regex to jump directly between headings in native C++
    const HEADING_REGEX = /^#{1,6}\s+(.*)$/gm;

    const newHeadingsData: { text: string; level: number; lineNbr: number; width: number }[] = [];
    let match: RegExpExecArray | null;

    while ((match = HEADING_REGEX.exec(doc)) !== null) {
      const charOffset = match.index;
      const fullMatch = match[0];
      const headingText = match[1] ? match[1].trim() : "";

      // Determine heading level by counting leading '#'
      let level = 0;
      while (fullMatch[level] === "#") {
        level++;
      }

      // Resolve character offset to line number in O(log N) time
      let lineNbr = 0;
      if (cmView) {
        lineNbr = cmView.state.doc.lineAt(charOffset).number - 1; // 0-indexed
      } else {
        lineNbr = editor.offsetToPos(charOffset).line;
      }

      newHeadingsData.push({
        level,
        text: headingText,
        lineNbr,
        width: 0,
      });
    }

    // Calculate heading line spans (widths)
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
  }

  private parseHeadingsFromText(doc: string): { text: string; level: number; lineNbr: number; width: number }[] {
    const lines = doc.split(/\r?\n/);
    const headings: { text: string; level: number; lineNbr: number; width: number }[] = [];

    for (let lineNbr = 0; lineNbr < lines.length; lineNbr++) {
      const line = lines[lineNbr]!;
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (!match) continue;

      headings.push({
        level: match[1]!.length,
        text: match[2]!.trim(),
        lineNbr,
        width: 0,
      });
    }

    for (let i = 0; i < headings.length; i++) {
      const current = headings[i]!;
      const next = headings[i + 1];
      current.width = next ? next.lineNbr - current.lineNbr : lines.length - current.lineNbr;
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

        delete this.nodeArr[oldNode.id];
        this.change.next(new TreeChange(TreeAction.delete, oldNode.id));
      } else {
        const newItem = newMap.get(key)!;
        oldNode.data.lineNbr = newItem.lineNbr;
        oldNode.data.width = newItem.width;
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
    const fileView = (this.plugin.app.workspace as any).getActiveFileView();
    const node = this.nodeArr[id];
    
    if (node === undefined) {
      throw Error("Node does not exist");
    }

    const view = fileView.currentMode;
    if (view.type === "preview") {
      view.renderer.applyScroll(node.data.lineNbr, { center: true, highlight: true });
    } else if (view.type === "source") {
      const startPos: EditorPosition = { line: node.data.lineNbr, ch: 0 };
      const endCh = view.editor.getLine(node.data.lineNbr).length;
      const endPos: EditorPosition = { line: node.data.lineNbr, ch: endCh };

      const ranges = [{ from: startPos, to: endPos }];

      view.editor.scrollIntoView({ from: startPos, to: endPos }, true);
      
      if (this.highlight > 0) {
        view.editor.removeHighlights(undefined);
      }
      
      view.editor.addHighlights(ranges, "is-flashing");
      this.highlight += 1;
      
      setTimeout(() => {
        if (this.highlight === 1) {
          view.editor.removeHighlights(undefined);
          this.highlight = 0;
        } else {
          this.highlight -= 1;
        }
      }, 3000);

      this.change.next(new TreeChange(TreeAction.scrolled, node.data.lineNbr)); 
    }
  }

  getExactCenterLine(editor: Editor | EditorView, zeroBased: boolean = true): number {
      const cmView = editor instanceof EditorView ? editor : (editor as any).cm as EditorView | undefined;
      if (!cmView) return (editor as Editor).getCursor().line;

      const scroller = cmView.scrollDOM;
      const midY = scroller.scrollTop + scroller.clientHeight / 2;

      const pos = cmView.lineBlockAtHeight(midY).from;
      const line1Based = cmView.state.doc.lineAt(pos).number;

      return zeroBased ? line1Based - 1 : line1Based;
  }
}