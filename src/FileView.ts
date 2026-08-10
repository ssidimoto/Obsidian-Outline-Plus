import {editorEditorField, ItemView, MarkdownView, WorkspaceLeaf } from 'obsidian';

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
    return 'File Index';
  }

  async onOpen() {
    const container = this.contentEl;
    this.vm = new TreeFileViewModel(this.plugin)
    this.ui = new TreeFileUi(this.vm, container.createDiv())
  }
}