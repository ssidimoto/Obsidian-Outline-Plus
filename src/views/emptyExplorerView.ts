import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Heading, htmlHeading } from 'datatypes/Heading';
import { HeadingNode, HeadingsTree } from 'datatypes/HeadingsTree';
import { maxHeadingDepth } from 'services/FileParser';
import { FileParser } from 'services/FileParser';

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

  tree: HeadingsTree
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

    container.createEl('style').textContent = this.heading_container_style
    container.createEl('h4', { text: 'File tree' });
    const closeBtn = container.createEl('button', { text: 'Close'});
    closeBtn.addEventListener('click', () => this.app.workspace.detachLeavesOfType(VIEW_TYPE_FILE_TREE));
    
    // Listen for editor content changes
    this.app.workspace.on('editor-change', editor => {
      let content = editor.getDoc().getValue()
          this.buildUiTree(content)
    })
  }

  buildUiTree(editorContent: string){
    // Clear previous tree
    this.containerEl.querySelectorAll('.heading-container').forEach(el => el.remove());
    this.contentEl.querySelectorAll('.heading-container').forEach(el => el.remove());
    let rootHeadingContainer = this.containerEl.createDiv({cls: 'heading-container'});
    let rootHeadingHeading = rootHeadingContainer.createDiv({cls: 'heading'});
    let rootSubHeading = rootHeadingContainer.createDiv({cls: 'sub-heading'});
    let rootHTMLHeading = new htmlHeading(rootHeadingContainer, rootHeadingHeading, rootSubHeading)
    let rootHeading = new Heading("Tree File Structure", Array(maxHeadingDepth).fill(0), rootHTMLHeading)
    let root = new HeadingNode(rootHeading, -1)
    this.tree = new HeadingsTree(root)

    let arr = FileParser.getAllHeadingsWithLevels(editorContent)
    let arr2 = FileParser.buildAllItemsNodes(arr)
    arr2.forEach((node) => this.tree.addNode(node))
    console.log(this.tree)
  }
  
  async onClose() {
    // Nothing to clean up.
  }
}