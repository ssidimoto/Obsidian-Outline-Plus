import { Heading, HtmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import FileTreeViewPlugin from "main";
import {EditorPosition} from "obsidian";
import { BehaviorSubject, Head } from 'rxjs'
import { Action } from "rxjs/internal/scheduler/Action";
import { EditorView } from "@codemirror/view"


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
    node: HeadingNode<Heading>|null|number
    constructor(action: TreeAction, node: HeadingNode<Heading>|null|number = null){
        this.action = action
        this.node = node
    }
}

/**
 * View model that builds and manages a heading tree for the active file,
 * emitting changes to observers.
 */
export class TreeFileViewModel{
    plugin: FileTreeViewPlugin
    tree: HeadingsTree<Heading>
    id: number = 1
    fileName: string
    private change = new BehaviorSubject<TreeChange|null>(null)
    readonly change$ = this.change.asObservable()
    highlight: number = 0
    nodeArr: HeadingNode<Heading>[] = []
    totalLines: number = 0

    currentSelection: {begin :number, end: number}
    prevSelection: {begin :number, end: number}


    constructor(plugin: FileTreeViewPlugin){
        this.plugin = plugin
        this.init()
        
    }

    /** Initialize listeners and root tree. */
    init(){
        const rootHeading = new Heading("Tree File Structure", -1, 0);
        const root = new HeadingNode(rootHeading, 0, 0);
        this.tree = new HeadingsTree(root);
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('editor-change', editor => {
                let content = editor.getDoc().getValue()

                let doc = (editor as any).cm.viewState.state.doc
                let selection = (editor as any).cm.viewState.state.selection.main
                let beginLine = doc.lineAt(selection.head).number - 1
                let endLine = doc.lineAt(selection.anchor).number - 1
                this.prevSelection = this.currentSelection
                this.currentSelection = {begin: Math.min(beginLine, endLine), end: Math.max(beginLine, endLine)}

                this.DocDiffRange(content, editor.getDoc().lineCount())
            })
        )

        this.plugin.registerEditorExtension(
            EditorView.updateListener.of(update => {
                if(update.selectionSet) {
                   let range = update.state.selection.main
                   let beginLine = update.state.doc.lineAt(range!.head).number - 1
                   let endLine = update.state.doc.lineAt(range!.anchor).number - 1
                   this.prevSelection = this.currentSelection
                    this.currentSelection = {begin: Math.min(beginLine, endLine), end: Math.max(beginLine, endLine)}
                    // console.log(this.currentSelection)
                    // console.log(this.prevSelection)
                    // console.log("----")
                }
            })
        )

        this.plugin.registerEvent(
           this.plugin.app.workspace.on('active-leaf-change', async () => {
                const file = this.plugin.app.workspace.getActiveFile();
                if(file && !this.fileName || file && this.fileName != file.basename) {
                    const content = await this.plugin.app.vault.read(file)
                    this.buildHeadingTree(content, (lines: number) => {
                        this.totalLines = lines
                        this.tree.root.childrens = []
                        this.nodeArr = []
                        this.id = 0
                        this.change.next(new TreeChange(TreeAction.destroy))
                    },
                    (node: HeadingNode<Heading>) =>{
                        this.nodeArr[node.id] = node
                        this.tree.addNode(node)
                        this.change.next(new TreeChange(TreeAction.add, node))
                    })
                    this.fileName = file.basename
                }
            })
        )
    }

    /** Parse a markdown document and rebuild the headings tree.
     * @param doc Markdown content for the active file.
     */
    buildHeadingTree(doc: string, init: (lines: number) => void,  action: (node: HeadingNode<Heading>) => void): void {
        const lines = doc.split('\n');
        init(lines.length)
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
                action(prevHeading)
                prevHeading = node
            }
        }

        prevHeading.data.width = lines.length - prevHeading.data.lineNbr
        action(prevHeading)
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
        const node = this.nodeArr[id]
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

    getPrevDocHeadings(): {heading: Heading, id: number}[]{
        let headings: {heading: Heading, id: number}[] = []
        let apply = (node: HeadingNode<Heading>) => {
            let heading = node.data
            headings.push({heading, id: node.id})
            // console.log(heading)
        }
        this.tree.inorderTraversal(apply, this.prevSelection)
        return headings
    }

    ParseNewDoc(doc: string, offset: number): {heading: Heading, depth: number}[]{
        let headings: {heading: Heading, depth: number}[]  = []
        const lines = doc.split('\n');
        const changedLines = lines.slice(this.prevSelection.begin, this.prevSelection.end + offset + 1 )
        if(!lines) return []

        let i = 0;
        while (i < changedLines.length && !changedLines[i]!.match(HEADING_REGEX)) {
            i++;
        }
        if (i >= changedLines.length) return [];

        const firstMatch = changedLines[i]!.match(HEADING_REGEX)!
        const firstDepth = firstMatch[0].trim().length;
        let prevHeading: {heading: Heading, depth: number} = {heading: new Heading(changedLines[i]!.substring(firstDepth).trim(), i + this.prevSelection.begin, 0), depth: firstDepth};
        prevHeading.heading.width = 0;
        headings.push(prevHeading)

        for (let j = i + 1; j < changedLines.length; j++) {
            const match = changedLines[j]!.match(HEADING_REGEX)
            if (match) {
                const depth = match[0].trim().length;
                const heading = new Heading(changedLines[j]!.substring(depth).trim(), j, 0);
                const width = j - prevHeading.heading.lineNbr
                prevHeading.heading.width = width
                headings.push({heading, depth})
                prevHeading = {heading, depth}
            }
        }

        prevHeading.heading.width = changedLines.length - prevHeading.heading.lineNbr
        return headings
    
    }
    DocDiffRange(doc: string, newDocLines: number){
        let offset = newDocLines - this.totalLines
        const oldDoc = this.getPrevDocHeadings()
        const newDoc = this.ParseNewDoc(doc, offset)
        console.log("old doc headings:")
        console.log(oldDoc)
        console.log("new doc headings:")
        console.log(newDoc)

        let oldDocMap = new Map()
        let newDocMap = new Map()
        for(let i = 0; i < oldDoc.length; i++){
            oldDocMap.set(oldDoc[i]!.heading.toString(), 1)
        }
        for(let i = 0; i < newDoc.length; i++){
            let newHeading = newDoc[i]
            if(newHeading) {
                newDocMap.set(newHeading.heading.toString(), 1)
                if(oldDocMap.get(newHeading.heading.toString()) == undefined){
                    let id = this.getId()
                    let newNode = new HeadingNode<Heading>(
                        newHeading.heading,
                        newHeading.depth, 
                        this.getId()
                    )
                    this.nodeArr[id] = newNode
                    this.tree.addNode(newNode)
                    this.change.next(new TreeChange(TreeAction.add, newNode))
                    console.log("added node: " + newNode.data.toString())
                }
            }
        }

        for(let i = 0; i < oldDoc.length; i++){
            if(newDocMap.get(oldDoc[i]!.heading.toString()) == undefined){
                let headingNode = this.nodeArr[oldDoc[i]!.id]
                this.tree.removeNode(headingNode!)
                this.change.next(new TreeChange(TreeAction.delete, headingNode!.id))
                console.log("deleted node: " + headingNode?.data.toString())
            }
        }
        this.totalLines = newDocLines

    }
}