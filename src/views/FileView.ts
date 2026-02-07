import {editorEditorField, ItemView, MarkdownView, WorkspaceLeaf } from 'obsidian';

import { TreeFileViewModel } from 'TreeFileViewModel';
import ExamplePlugin from 'main';
import { TreeFileUi } from 'TreeFileUI';

export const VIEW_TYPE_FILE_TREE = 'file-tree-view';

export class FileTreeView extends ItemView {
  heading_container_style = `
    .heading {
      display: flex;
      text-align: right;
      flex-direction: row;
      align-items: center;
    }
    .heading-text{
      font-size: 20px
    }
    .sub-headings{
      padding-left: 25px;
    }
  `;
  vm: TreeFileViewModel
  ui: TreeFileUi
  plugin: ExamplePlugin

  constructor(leaf: WorkspaceLeaf, plugin: ExamplePlugin) {
    super(leaf);
    this.plugin = plugin
  }

  getViewType() {
    return VIEW_TYPE_FILE_TREE;
  }

  getDisplayText() {
    return 'File tree';
  }

  async onOpen() {
    const container = this.contentEl;
    this.vm = new TreeFileViewModel(this.plugin)
    this.ui = new TreeFileUi(this.vm, container.createDiv())
    // container.createEl('style').textContent = this.heading_container_style
    // container.createEl('h4', { text: 'File tree' });

    // const closeBtn = container.createEl('button', { text: 'Close'});
    // closeBtn.addEventListener('click', () => this.app.workspace.detachLeavesOfType(VIEW_TYPE_FILE_TREE));
    // create el from html 
  }
  async onClose() {
    
  }
}