import { Heading, HtmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import FileTreeViewPlugin from "main";
import { EditorPosition, MarkdownView, TFile } from "obsidian";
import { BehaviorSubject } from 'rxjs';
import { Editor } from 'obsidian';
import { EditorView } from '@codemirror/view'

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
 * using Obsidian's MetadataCache, emitting changes to observers.
 */
export class TreeFileViewModel {
  plugin: FileTreeViewPlugin;
  tree!: HeadingsTree<Heading>;
  id: number = 1;
  fileName: string | null = null;
  private change = new BehaviorSubject<TreeChange | null>(null);
  readonly change$ = this.change.asObservable();
  highlight: number = 0;
  nodeArr: HeadingNode<Heading>[] = [];

  hooveredNode: HeadingNode<HtmlHeading> | undefined = undefined;

  constructor(plugin: FileTreeViewPlugin) {
    this.plugin = plugin;
    this.init();
  }

  /** Initialize metadata cache listeners and root tree. */
  init() {
    const rootHeading = new Heading("Tree File Structure", -1, 0);
    const root = new HeadingNode(rootHeading, 0, 0);
    this.tree = new HeadingsTree(root);

    // 1. Écouter le changement de fichier actif
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile && this.fileName !== activeFile.basename) {
          this.handleFileSwitch(activeFile);
        }
      })
    );

    // 2. Écouter les mises à jour du cache de métadonnées (AST Markdown d'Obsidian)
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on('changed', (file, _, cache) => {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile && file.path === activeFile.path) {
          this.syncTreeFromCache(file);
        }
      })
    );
  

    this.plugin.registerEditorExtension(
        EditorView.domEventHandlers({
            scroll: (event, cmView) => {
            this.onEditorScroll(cmView);
            }
        })
    );
}

  private onEditorScroll(editor : Editor | EditorView) {
    const centerLine = this.getExactCenterLine(editor, true);
    this.change.next({
        action: TreeAction.scrolled,
        node: centerLine
    });
}

  /** Réinitialise l'arbre lors du passage à un nouveau fichier */
  private handleFileSwitch(file: TFile) {
    this.fileName = file.basename;
    this.tree.root.childrens = [];
    this.nodeArr = [];
    this.id = 0;

    // Avertir les observateurs que l'ancien arbre est détruit
    this.change.next(new TreeChange(TreeAction.destroy));

    // Construire le nouvel arbre à partir du cache
    this.syncTreeFromCache(file);
  }

  /**
   * Synchronise et effectue le diff de l'arbre à partir du cache Obsidian
   */
    private syncTreeFromCache(file: TFile) {
        const cache = this.plugin.app.metadataCache.getFileCache(file);
        const cacheHeadings = cache?.headings || [];

        // Formater les métadonnées Obsidian vers le type Heading
        const newHeadingsData = cacheHeadings.map((h, index) => {
        const lineNbr = h.position.start.line; // 0-indexed line number
        const nextLineNbr = index < cacheHeadings.length - 1 
            ? cacheHeadings[index + 1]!.position.start.line 
            : lineNbr + 1;

        const width = Math.max(0, nextLineNbr - lineNbr);
        return {
            text: h.heading,
            level: h.level,
            lineNbr: lineNbr,
            width: width
        };
        });

        // Extraction des nœuds existants (hors racine)
        const oldNodes = this.nodeArr.filter((n): n is HeadingNode<Heading> => n !== undefined);

        // Clef unique identifiant un nœud : "Ligne:Niveau:Texte"
        const oldMap = new Map<string, HeadingNode<Heading>>();
        oldNodes.forEach(node => {
        oldMap.set(`${node.data.lineNbr}:${node.depth}:${node.data.headLine}`, node);
        });

        const newMap = new Map<string, typeof newHeadingsData[0]>();
        newHeadingsData.forEach(item => {
        newMap.set(`${item.lineNbr}:${item.level}:${item.text}`, item);
        });

        // 1. Suppression des nœuds absents du nouveau cache
        for (const [key, oldNode] of oldMap.entries()) {
        if (!newMap.has(key)) {
            this.tree.removeNode(oldNode);
            delete this.nodeArr[oldNode.id];
            this.change.next(new TreeChange(TreeAction.delete, oldNode.id));
        }
        }

        // 2. Ajout des nouveaux nœuds
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

  /** Génère un ID incrémental pour chaque nœud */
  getId(): number {
    return this.id++;
  }

  /** Défilement vers le titre sélectionné dans l'éditeur */
  async OnHeadingClicked(id: number) {
    const fileView = (this.plugin.app.workspace as any).getActiveFileView();
    const node = this.nodeArr[id];
    if (node === undefined) {
      throw Error("Node does not exist");
    }

    let view = fileView.currentMode;
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

        // Calculate pixel mid-point of the visible viewport container
        const scroller = cmView.scrollDOM;
        const midY = scroller.scrollTop + scroller.clientHeight / 2;

        // Resolve the document position at that pixel offset
        const pos = cmView.lineBlockAtHeight(midY).from;
        const line1Based = cmView.state.doc.lineAt(pos).number;

        return zeroBased ? line1Based - 1 : line1Based;
    }
}