import { MarkdownView, Plugin, renderResults, WorkspaceLeaf } from 'obsidian';
import { FileTreeView, VIEW_TYPE_FILE_TREE } from './views/emptyExplorerView';
import { Console } from 'console';
import { FileParser, maxHeadingDepth } from 'services/FileParser';
import { HeadingNode, HeadingsTree } from 'datatypes/HeadingsTree';
import { Heading } from 'datatypes/Heading';

export default class ExamplePlugin extends Plugin {
  tree: HeadingsTree<Heading>
  async onload() {
    this.registerView(
      VIEW_TYPE_FILE_TREE,
      (leaf) => new FileTreeView(leaf)
    );
    let heading = new Heading("Tree File Structure", Array().fill(0, maxHeadingDepth))
    let root = new HeadingNode(heading, -1)
    this.tree = new HeadingsTree(root)

    this.addRibbonIcon('list-tree', 'Activate view', () => {
      this.activateView();
    });

    console.log("ntm")

    this.app.workspace.on('active-leaf-change', () => {
      const file = this.app.workspace.getActiveFile();
      if(file){
        const content = this.app.vault.read(file)
        content.then((result) => {
          let arr = FileParser.getAllHeadingsWithLevels(result)
          let arr2 = FileParser.buildAllItemsNodes(arr)
          arr2.forEach((node) => this.tree.addNode(node))
          console.log(this.tree)
          });
      }
    });

    // this.app.workspace.on('editor-change', editor => {
    //   let content = editor.getDoc().getValue()
    //       let arr = FileParser.getAllHeadingsWithLevels(content);
    //       let arr2 = FileParser.buildAllItemsNodes(arr)
    //       console.log(arr2);
    // })
  }

  async onunload() {
    const { workspace } = this.app;
    workspace.detachLeavesOfType(VIEW_TYPE_FILE_TREE);
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_FILE_TREE);

    if (leaves.length > 0) {
      leaf = leaves[0] ?? null;
    } else {
      leaf = workspace.getLeftLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_FILE_TREE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}