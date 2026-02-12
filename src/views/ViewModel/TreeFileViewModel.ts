import { Heading, HtmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import ExamplePlugin from "main";
import {EditorPosition} from "obsidian";
import { BehaviorSubject, Head } from 'rxjs'

export const maxHeadingDepth = 6
const topLinePadding = 8
const LATEX_REGEX = /\$(.+?)\$/g;
const HEADING_REGEX = /^#{1,6} /

export type TreeLatestChange = {
  action: TreeAction
  heading: HeadingNode<Heading>
}

export enum TreeAction{
    add,
    delete,
    destroy,
    nothing
}

export class TreeChange{
    action: TreeAction
    node: HeadingNode<Heading>|null
    constructor(action: TreeAction, node: HeadingNode<Heading>|null = null){
        this.action = action
        this.node = node
    }
}

/**
 * View model that builds and manages a heading tree for the active file,
 * emitting changes to observers.
 */
export class TreeFileViewModel{
    plugin: ExamplePlugin
    tree: HeadingsTree<Heading>
    id: number = 1
    nodeDict: Map<number, HeadingNode<Heading>> = new Map()
    fileName: string
    private change = new BehaviorSubject<TreeChange|null>(null)
    readonly change$ = this.change.asObservable()
    highlight: number = 0

    constructor(plugin: ExamplePlugin){
        this.plugin = plugin
        this.init()
        
    }

    /** Initialize listeners and root tree. */
    init(){
        const rootHeading = new Heading("Tree File Structure", 0, 0);
        const root = new HeadingNode(rootHeading, 0, 0);
        this.tree = new HeadingsTree(root);
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('editor-change', editor => {
                let content = editor.getDoc().getValue()
                this.buildHeadingTree(content)
            })
        )

        this.plugin.registerEvent(
           this.plugin.app.workspace.on('active-leaf-change', async () => {
                const file = this.plugin.app.workspace.getActiveFile();
                if(file && !this.fileName || file && this.fileName != file.basename) {
                    const content = await this.plugin.app.vault.read(file)
                    this.buildHeadingTree(content)
                    this.fileName = file.basename
                }
            })
        )
    }

    /** Parse a markdown document and rebuild the headings tree.
     * @param doc Markdown content for the active file.
     */
    buildHeadingTree(doc: string): void {
        this.tree.root.childrens = []
        this.nodeDict.clear()
        this.change.next(new TreeChange(TreeAction.destroy))

        const multiLevelCount = Array(maxHeadingDepth).fill(0);
        const lines = doc.split('\n');
        if(!lines) return

        let i = 0;
        while (i < lines.length && !lines[i]!.match(HEADING_REGEX)) {
            i++;
        }
        if (i >= lines.length) return;

        const firstMatch = lines[i]!.match(HEADING_REGEX)!
        const firstDepth = firstMatch[0].trim().length;
        const firstHeading = new Heading(lines[i]!.substring(firstDepth).trim(), i, 0);
        let prevHeading: HeadingNode<Heading> = new HeadingNode(firstHeading, firstDepth, this.getId());
        prevHeading.data.width = 0;

        for (let j = i + 1; j < lines.length; j++) {
            const match = lines[j]!.match(HEADING_REGEX)
            if (match) {
                const depth = match[0].trim().length;
                const heading = new Heading(lines[j]!.substring(depth).trim(), j, 0);
                const node = new HeadingNode(heading, depth, this.getId());

                const width = j - prevHeading.data.lineNbr
                prevHeading.data.width = width
                this.nodeDict.set(prevHeading.id, prevHeading)
                this.tree.addNode(prevHeading)
                this.change.next(new TreeChange(TreeAction.add, prevHeading))
                console.log(prevHeading)
                prevHeading = node
            }
        }

        prevHeading.data.width = prevHeading.data.lineNbr - lines.length
        this.nodeDict.set(prevHeading.id, prevHeading)
        this.tree.addNode(prevHeading)
        this.change.next(new TreeChange(TreeAction.add, prevHeading))
        console.log(prevHeading)
        console.log(this.tree)

    }

    /** Generate a monotonically increasing node id. */
    getId(): number{
        return this.id++
    }

    /** Scroll to the selected heading in the active view and highlight it.
     * @param id Heading node id to scroll to.
     */
    async OnHeadingClicked(id: number){
        const fileView = (this.plugin.app.workspace as any).getActiveFileView();
        const node = this.nodeDict.get(id)
        if(node == undefined){
            throw Error("this node does not exist")
        }

        let view = fileView.currentMode
        if(view.type == "preview"){
            view.renderer.applyScroll(node?.data.lineNbr, {center: true, highlight: true})
        }
        else if(view.type == "source"){
            const startPos: EditorPosition = { line: node.data.lineNbr, ch: 0 };
            const endCh = view.editor.getLine(node.data.lineNbr).length;
            const endPos: EditorPosition = { line: node.data.lineNbr, ch: endCh };

            const ranges = [{ from: startPos, to: endPos }];

            view.editor.scrollIntoView({ from: startPos, to: endPos }, true);
            if(this.highlight > 0){
                view.editor.removeHighlights(undefined)
            }
            view.editor.addHighlights(ranges, "is-flashing")
            this.highlight += 1;
            setTimeout(() => {
                if(this.highlight == 1){
                    view.editor.removeHighlights(undefined)
                    this.highlight = 0;
                }else{
                this.highlight -= 1;
                }
            }, 3000);
        }
    }
}