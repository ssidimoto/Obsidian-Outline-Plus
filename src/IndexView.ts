import { ItemView, WorkspaceLeaf } from 'obsidian';

import { TreeFileViewModel } from 'views/ViewModel/TreeFileViewModel';
import ExamplePlugin from 'main';
import { TreeFileUi } from 'UI/TreeFileUI';

export const VIEW_TYPE_FILE_TREE = 'file-tree-view';

export class FileTreeView extends ItemView {
  vm!: TreeFileViewModel
  ui!: TreeFileUi
  plugin: ExamplePlugin

  constructor(leaf: WorkspaceLeaf, plugin: ExamplePlugin) {
    super(leaf);
    this.plugin = plugin
  }

  getViewType() {
    return VIEW_TYPE_FILE_TREE;
  }

  getDisplayText() {
    return 'File index';
  }
  
  getIcon() {
    return 'list-tree';
  }
  
  async onOpen() {
    const container = this.contentEl;
    this.vm = new TreeFileViewModel(this.plugin, this)
    // The view is a Component, so it owns every listener the view model registers and the
    // lifecycle of everything the rendered heading titles spawn: closing the leaf takes the
    // whole set with it instead of stacking another one on the next open.
    this.ui = new TreeFileUi(this.vm, container.createDiv(), this)
  }

  async onClose() {
    this.ui?.destroy()
  }
}
