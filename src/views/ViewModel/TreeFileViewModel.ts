import { Heading, HtmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import FileTreeViewPlugin from "main";
import { EditorPosition, MarkdownView, TFile, debounce, Editor } from "obsidian";
import { BehaviorSubject } from 'rxjs';
import { EditorView } from '@codemirror/view';
import { SETTINGS } from "../../main";

export const maxHeadingDepth = 6;

export enum TreeAction {
  add,
  delete,
  destroy,
  nothing,
  scrolled,
  Error,
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
  tree!: HeadingsTree<Heading>;
  id: number = 1;
  fileName: string | null = null;
  private lastKnownFile: TFile | null = null;
  private lastParsedDoc: string = "";
  
  private change = new BehaviorSubject<TreeChange | null>(null);
  readonly change$ = this.change.asObservable();
  
  highlight: number = 0;
  nodeArr: HeadingNode<Heading>[] = [];
  hooveredNode: HeadingNode<HtmlHeading> | undefined = undefined;

  // Debounce the live editor parsing to maintain high typing performance (150ms delay)
  private debouncedFileSync = debounce((file: TFile) => {
    this.syncTreeFromFile(file);
  }, 0, true);

  constructor(plugin: FileTreeViewPlugin) {
    this.plugin = plugin;
    this.init();
  }

  /** Initialize listeners and root tree. */
  init() {
    const rootHeading = new Heading("Tree File Structure", -1, 0);
    const root = new HeadingNode(rootHeading, 0, 0);
    this.tree = new HeadingsTree(root);
    //detect file closing even if not focus

  //listen with layout change and print some deug info
  this.plugin.registerEvent(
    this.plugin.app.workspace.on('layout-change', () => {
      let view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      //if view null means file got deleted
      if(view === null) {
        console.log("File closed or deleted, destroying tree.");
        this.destroyTree();
        this.change.next(new TreeChange(TreeAction.Error));
      }

    })
  );
    // 1. Listen for active file change
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('file-open', (file: TFile | null) => {
        //get active mark down file
        let view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        console.log(`Active file changed to: ${file?.basename ?? "none"}`);

        if (file && view && view.file && file.basename == view.file.basename) {
          this.handleFile(file);
        } else {
          this.destroyTree();
          this.change.next(new TreeChange(TreeAction.Error));
        }
      })
    );

    // 2. Listen for live editor changes (Instant UI!)
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('editor-change', (editor, info) => {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile && info?.file && info.file.path === activeFile.path && SETTINGS.manualUpdate === false) {
            this.lastKnownFile = info.file;
            this.debouncedFileSync(info.file);
            setTimeout(() => {
            }, SETTINGS.refreshRate); // Refresh rate is handled by the debounce function
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

    //load params from lcoalstorage and load them into defautl params
    const savedSettings = localStorage.getItem('fileTreeSettings');
    if (savedSettings) {
        Object.assign(SETTINGS, JSON.parse(savedSettings));
    }

    //store current data parameters when app is closed
    this.plugin.registerEvent(
        this.plugin.app.workspace.on('quit', () => {
            localStorage.setItem('fileTreeSettings', JSON.stringify(SETTINGS));
        })
    );

    if(!this.lastKnownFile) {
      console.log("No active file found during scroll event.");
      this.change.next(new TreeChange(TreeAction.Error));
    }
  }

  private onEditorScroll(editor: Editor | EditorView) {
    const centerLine = this.getExactCenterLine(editor, true);
    this.change.next({
        action: TreeAction.scrolled,
        node: centerLine
    }); 
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
        if(val) {
          SETTINGS.manualUpdate = val !== 0;
        }
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
    console.log(`Handling file switch to: ${file.basename}`);
    this.lastKnownFile = file;
    this.fileName = file.basename;
    this.tree.root.childrens = [];
    this.nodeArr = [];
    this.id = 1;

    console.log(`Switching to file: ${file.basename}`);
    this.destroyTree();
    this.syncTreeFromFile(file);
  }

  destroyTree() {
    this.tree.root.childrens = [];
    this.nodeArr = [];
    this.id = 1;
    this.change.next(new TreeChange(TreeAction.destroy));
  }

  private async syncTreeFromFile(file: TFile) {
    const doc = await this.plugin.app.vault.cachedRead(file);
    this.lastParsedDoc = doc;
    this.applyHeadingsData(this.parseHeadingsFromText(doc));
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