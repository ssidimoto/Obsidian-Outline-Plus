import { MarkdownView, Plugin, renderResults, WorkspaceLeaf, App, loadMathJax} from 'obsidian';
import { FileTreeView, VIEW_TYPE_FILE_TREE } from './IndexView';
import { TreeFileViewModel } from 'views/ViewModel/TreeFileViewModel';
import {ParametersData} from 'datatypes/Parameters';


export var SETTINGS = new ParametersData(1, 0, false, 0);

export default class FileTreeViewPlugin extends Plugin {

  vm!: TreeFileViewModel
  
  async onload() {
    console.log("dog shit 1")
    this.registerView(
      VIEW_TYPE_FILE_TREE,
      (leaf) => new FileTreeView(leaf, this)
    );
    console.log("dog shit")
    this.app.workspace.onLayoutReady(() => {
      this.initView();
    });
    
    await loadMathJax();
    //add ribon icon 
    this.addRibbonIcon('list-tree', 'File Tree View', async () => {
      this.initView();
    });
    
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

  private async initView() {
        const { workspace } = this.app;

        // Check if Obsidian ALREADY restored your view leaf from workspace.json
        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_FILE_TREE);

        if (existingLeaves.length > 0) {
            // Leaf was restored successfully by Obsidian on reload!
            console.log("Tree file view leaf restored successfully.");
            return;
        }

        // Only create a new leaf if it wasn't restored (e.g., first run)
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({
                type: VIEW_TYPE_FILE_TREE,
                active: true,
            });
            workspace.revealLeaf(leaf);
        }
        //reveal leaf
    }
}