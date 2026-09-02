import { Plugin, loadMathJax} from 'obsidian';
import { FileTreeView, VIEW_TYPE_FILE_TREE } from './IndexView';
import { TreeFileViewModel } from 'views/ViewModel/TreeFileViewModel';
import {ParametersData} from 'datatypes/Parameters';


export const SETTINGS = new ParametersData(1, 0, false, 0);

export default class FileTreeViewPlugin extends Plugin {

  vm!: TreeFileViewModel
  
  async onload() {
    this.registerView(
      VIEW_TYPE_FILE_TREE,
      (leaf) => new FileTreeView(leaf, this)
    );
    this.app.workspace.onLayoutReady(() => {
      void this.initView();
    });
    
    await loadMathJax();
    //add ribon icon 
    this.addRibbonIcon('list-tree', 'File tree view', () => {
      void this.initView();
    });
  }

  private async initView() {
        const { workspace } = this.app;

        // Check if Obsidian ALREADY restored your view leaf from workspace.json
        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_FILE_TREE);

        if (existingLeaves.length > 0) {
            // Leaf was restored successfully by Obsidian on reload!
            return;
        }

        // Only create a new leaf if it wasn't restored (e.g., first run)
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({
                type: VIEW_TYPE_FILE_TREE,
                active: true,
            });
            await workspace.revealLeaf(leaf);
        }
        //reveal leaf
    }
}
