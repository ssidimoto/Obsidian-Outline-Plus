import { MarkdownView, Plugin, renderResults, WorkspaceLeaf, App} from 'obsidian';
import { FileTreeView, VIEW_TYPE_FILE_TREE } from './views/emptyExplorerView';
import { Console } from 'console';
import { FileParser, maxHeadingDepth } from 'services/FileParser';
import { HeadingNode, HeadingsTree } from 'datatypes/HeadingsTree';
import { Heading } from 'datatypes/Heading';
import { UiHelper } from 'services/UiHelper';

export default class ExamplePlugin extends Plugin {

  uiHelper: UiHelper
  fileParser: FileParser
  
  async onload() {

    let uiHelper = new UiHelper(this.app)
    this.uiHelper = uiHelper
    this.fileParser = new FileParser(this.app, uiHelper)

    this.registerView(
      VIEW_TYPE_FILE_TREE,
      (leaf) => new FileTreeView(leaf, this.fileParser, this.uiHelper)
    );

    this.addRibbonIcon('list-tree', 'Activate view', () => {
      this.activateView();
    });
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