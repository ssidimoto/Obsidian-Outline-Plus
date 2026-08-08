import { MarkdownView, Plugin, renderResults, WorkspaceLeaf, App} from 'obsidian';
import { FileTreeView, VIEW_TYPE_FILE_TREE } from './views/FileView';
import { TreeFileViewModel } from 'views/ViewModel/TreeFileViewModel';

export default class FileTreeViewPlugin extends Plugin {

  vm!: TreeFileViewModel
  
  async onload() {
    this.registerView(
      VIEW_TYPE_FILE_TREE,
      (leaf) => new FileTreeView(leaf, this)
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
//options for dynamic collapse
//option to keep tree always expended given certain depth value
//option to collapse all or expand all
//option for keeping minimal depth always uncollapsed
//option for seeing which depth difference tree collapses
//new class for parameters
//local storage
//improve code structure
//fix bug where subheading deleted when parent heading is deleted
//fix latex compilation error