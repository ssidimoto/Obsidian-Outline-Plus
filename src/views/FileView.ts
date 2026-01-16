import {ItemView, WorkspaceLeaf } from 'obsidian';

import { TreeFileViewModel } from 'HeadingTreeViewModel';
import ExamplePlugin from 'main';

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
  component: ExamplePlugin
  constructor(leaf: WorkspaceLeaf, component: ExamplePlugin, vm: TreeFileViewModel) {
    super(leaf);
    this.component = component
    this.vm = vm
  }

  getViewType() {
    return VIEW_TYPE_FILE_TREE;
  }

  getDisplayText() {
    return 'File tree';
  }

  async onOpen() {
    const container = this.contentEl;

    container.createEl('style').textContent = this.heading_container_style
    container.createEl('h4', { text: 'File tree' });

    const closeBtn = container.createEl('button', { text: 'Close'});
    closeBtn.addEventListener('click', () => this.app.workspace.detachLeavesOfType(VIEW_TYPE_FILE_TREE));
  }

  async onClose() {
  }
}