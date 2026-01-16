import { MarkdownView, Plugin, renderResults, WorkspaceLeaf, App} from 'obsidian';
import { FileTreeView, VIEW_TYPE_FILE_TREE } from './views/FileView';
import { Console } from 'console';
import { HeadingNode, HeadingsTree } from 'datatypes/HeadingsTree';
import { Heading } from 'datatypes/Heading';
import { UiHelper } from 'services/UiHelper';
import { TreeFileViewModel } from 'HeadingTreeViewModel';

export default class FileTreeViewPlugin extends Plugin {

  uiHelper: UiHelper
  vm: TreeFileViewModel
  
  async onload() {
    console.log("loaded !")
    this.vm = new TreeFileViewModel(this)
    this.registerView(
      VIEW_TYPE_FILE_TREE,
      (leaf) => new FileTreeView(leaf, this, this.vm)
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