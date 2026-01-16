import { ItemView, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { Heading, htmlHeading } from 'datatypes/Heading';
import { HeadingNode, HeadingsTree } from 'datatypes/HeadingsTree';
import { maxHeadingDepth } from 'services/FileParser';
import { FileParser } from 'services/FileParser';
import { UiHelper } from 'services/UiHelper';
import { Editor, EditorPosition } from 'obsidian';

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

  tree: HeadingsTree;

  fileParser: FileParser
  uiHelper: UiHelper

  constructor(leaf: WorkspaceLeaf, fileParser: FileParser, uiHelper: UiHelper) {
    super(leaf);
    this.fileParser = fileParser
    this.uiHelper = uiHelper
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
    

    this.registerEvent(
      
    );
  }

  buildUiTree(editorContent: string, editor: Editor){
    // Clear previous tree
    this.containerEl.querySelectorAll('.heading-container').forEach(el => el.remove());

    let htmlRootHeading = UiHelper.createRootHtmlHeading(this.containerEl)
    let rootHeading = new Heading("Tree File Structure", Array(maxHeadingDepth).fill(0), htmlRootHeading)
    let root = new HeadingNode(rootHeading, -1, -1)
    this.tree = new HeadingsTree(root)

    let nodes = this.fileParser.BuildAllHeadingItem(editorContent, editor)
    nodes.forEach((node) => this.tree.addNode(node))
  }
  async onClose() {
    // Nothing to clean up.
  }
}