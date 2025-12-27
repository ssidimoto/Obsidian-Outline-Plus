import { ItemView, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_FILE_TREE = 'file-tree-view';

export class FileTreeView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_FILE_TREE;
  }

  getDisplayText() {
    return 'File tree';
  }

  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.createEl('h4', { text: 'File tree' });
    const closeBtn = container.createEl('button', { text: 'Close' });
    closeBtn.addEventListener('click', () => this.app.workspace.detachLeavesOfType(VIEW_TYPE_FILE_TREE));
  }

  async onClose() {
    // Nothing to clean up.
  }
}