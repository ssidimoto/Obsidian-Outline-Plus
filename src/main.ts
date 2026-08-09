import { MarkdownView, Plugin, renderResults, WorkspaceLeaf, App, loadMathJax} from 'obsidian';
import { FileTreeView, VIEW_TYPE_FILE_TREE } from './views/FileView';
import { TreeFileViewModel } from 'views/ViewModel/TreeFileViewModel';
import {ParametersData} from 'views/ViewModel/ParametersViewModel';


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

//option to collapse all or expand all
//option for keeping minimal depth always uncollapsed
//option for seeing which depth difference tree collapses for dynamic collapse
//new class for parameters
//local storage
//improve code structure
//fix latex compilation error