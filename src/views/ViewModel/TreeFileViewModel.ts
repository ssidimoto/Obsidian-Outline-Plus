import { Heading, HtmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import ExamplePlugin from "main";
import {EditorPosition} from "obsidian";
import { BehaviorSubject, Head } from 'rxjs'

export const maxHeadingDepth = 6
const topLinePadding = 8
const LATEX_REGEX = /\$(.+?)\$/g;

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
        const rootHeading = new Heading("Tree File Structure", Array(maxHeadingDepth).fill(0), 0);
        const root = new HeadingNode(rootHeading, -1, 0);
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
        let currDepth = 0;

        lines.forEach((line, lineNbr) => {
            const hashMatch = line.match(/^#{1,6} /);
            if (hashMatch){

                const depth = hashMatch[0].trim().length;
                const headLine = line.substring(depth).trim();
                const arrLevel = depth - 1;

                // Update level counters
                if (currDepth === arrLevel) {
                    multiLevelCount[currDepth] += 1;
                } else if (currDepth < arrLevel) {
                    multiLevelCount[arrLevel] = 1;
                    currDepth = arrLevel;
                } else if (currDepth > arrLevel) {
                    multiLevelCount.fill(0, arrLevel + 1, maxHeadingDepth - 1);
                    multiLevelCount[arrLevel] += 1;
                    currDepth = arrLevel;
                }
                const id = this.getId()
                const heading = new Heading(headLine, multiLevelCount.slice(), lineNbr);
                const node = new HeadingNode(heading, currDepth, id);
                this.tree.addNode(node)
                this.nodeDict.set(id, node)
                this.change.next(new TreeChange(TreeAction.add, node))
            }
        });
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
                }
                this.highlight -= 1;
            }, 3000);
        }
    }

    /** Toggle a heading node's expanded/collapsed state in the UI.
     * @param node The heading UI node to toggle.
     */
    OnHeadingButtonClicked(node: HtmlHeading){
        const childrenEl = node.childrens as HTMLElement
        if(node.IconEl.getAttribute("class")?.includes("is-collapsed")){
            node.IconEl.removeClass("is-collapsed")
            node.FolderEl.insertAdjacentElement("beforeend", childrenEl)
            this.animateExpand(childrenEl)
        }
        else{
            node.IconEl.addClass("is-collapsed")
            this.animateCollapse(childrenEl)
        }
    }

    private animateCollapse(childrenEl: HTMLElement){
        if (!childrenEl.isConnected) return;
        const startHeight = childrenEl.scrollHeight;
        childrenEl.style.overflow = "hidden";
        childrenEl.style.height = `${startHeight}px`;
        childrenEl.style.transition = "height 150ms ease";
        void childrenEl.offsetHeight;
        childrenEl.style.height = "0px";

        const onEnd = (event: TransitionEvent) => {
            if (event.target !== childrenEl) return;
            childrenEl.removeEventListener("transitionend", onEnd);
            childrenEl.remove();
            childrenEl.style.height = "";
            childrenEl.style.overflow = "";
            childrenEl.style.transition = "";
        };
        childrenEl.addEventListener("transitionend", onEnd);
    }

    private animateExpand(childrenEl: HTMLElement){
        const targetHeight = childrenEl.scrollHeight;
        childrenEl.style.overflow = "hidden";
        childrenEl.style.height = "0px";
        childrenEl.style.transition = "height 150ms ease";
        void childrenEl.offsetHeight;
        childrenEl.style.height = `${targetHeight}px`;

        const onEnd = (event: TransitionEvent) => {
            if (event.target !== childrenEl) return;
            childrenEl.removeEventListener("transitionend", onEnd);
            childrenEl.style.height = "";
            childrenEl.style.overflow = "";
            childrenEl.style.transition = "";
        };
        childrenEl.addEventListener("transitionend", onEnd);
    }
}