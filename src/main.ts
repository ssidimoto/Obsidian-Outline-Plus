import { MarkdownView, Plugin, renderResults, WorkspaceLeaf, App, loadMathJax} from 'obsidian';
import { FileTreeView, VIEW_TYPE_FILE_TREE } from './FileView';
import { TreeFileViewModel } from 'views/ViewModel/TreeFileViewModel';
import {ParametersData} from 'datatypes/Parameters';


export var SETTINGS = new ParametersData(1, 0, false, 0);

export default class FileTreeViewPlugin extends Plugin {

  vm!: TreeFileViewModel
  
  async onload() {
    this.registerView(
      VIEW_TYPE_FILE_TREE,
      (leaf) => new FileTreeView(leaf, this)
    );
    
    this.addRibbonIcon('list-tree', 'Activate view', () => {
    });

    await loadMathJax();

    const style = document.createElement('style');
    style.textContent = `
      .tooltip{
        z-index: 10000;
        background-color: rgba(0, 0, 0, 0.5);
        text-align: left;
        padding: 5px;
      }
      .menu-item:hover {
        background-color: var(--background-modifier-hover);
      }
    `;
    document.head.appendChild(style);
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
//improve code readability and add comments
//add error message when view not activated on non markdown file
//close button on top of view
//proper git to make
//obsidian account and prerequisites for plugin publication, github on repo with readme
//fix two buttons for plugin on sidebar
