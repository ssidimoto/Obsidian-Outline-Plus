import { Heading, htmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import ExamplePlugin from "main";
import { App, Component, EditorPosition, MarkdownView, } from "obsidian";
import { BehaviorSubject } from 'rxjs'

export const maxHeadingDepth = 6
const topLinePadding = 8

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

export class TreeFileViewModel{
    plugin: ExamplePlugin
    tree: HeadingsTree<Heading>
    id: number = 1
    nodeDict: Map<number, HeadingNode<Heading>> = new Map()

    private change = new BehaviorSubject<TreeChange|null>(null)
    
    readonly change$ = this.change.asObservable()

    constructor(plugin: ExamplePlugin){
        this.plugin = plugin
        this.init()
        
    }

    init(){
        console.log("init")
        const rootHeading = new Heading("Tree File Structure", Array(maxHeadingDepth).fill(0), 0);
        const root = new HeadingNode(rootHeading, -1, 0);
        this.tree = new HeadingsTree(root);
        //maybe check editor change is in same editor
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('editor-change', editor => {
                let content = editor.getDoc().getValue()
                this.buildHeadingTree(content)

            })
        )

        this.plugin.registerEvent(
           this.plugin.app.workspace.on('active-leaf-change', async () => {
                const file = this.plugin.app.workspace.getActiveFile();
                if(file) {
                    const content = await this.plugin.app.vault.read(file)
                    this.buildHeadingTree(content)
                }                
            })
        )
    }
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

    getId(): number{
        return this.id++
    }

    OnHeadingClicked(id: number){
        const fileView = (this.plugin.app.workspace as any).getActiveFileView();
        const node = this.nodeDict.get(id)
        if(node == undefined){
            throw Error("this node does not exist")
        }

        let view = fileView.currentMode
        if(view.type == "preview" || view.type == "source" ){
            view.applyScroll(node?.data.lineNbr - topLinePadding)
            this.highlightHeading(node.data.lineNbr, node.depth, fileView, node.data.headLine)    
  
        }
    }
    OnHeadingButtonClicked(node: htmlHeading){
       node.subHeading.hidden = !node.subHeading.hidden
    }

    async highlightHeading(lineNbr: number, depth: number, fileView: any, heading: string) {
        setTimeout(() => {}, 1000);
        let containerEl = fileView.containerEl
        // Get the DOM element for the line in the editor
        const type = fileView.currentMode.type
        let selector = (type == 'source')? `.cm-header-${depth + 1}`: `h${depth + 1}`

        if(fileView.editMode){
            const lineElements = containerEl.querySelectorAll(selector);
            if (lineElements.length === 0) return;
            
            // Iterate through all heading elements to find the one matching the heading text
            for (let i = 0; i < lineElements.length; i++) {
                const headingTextEl = lineElements[i];
                console.log(headingTextEl.dataset.heading.trim() + "/" + heading.trim())
                console.log(headingTextEl.dataset.heading.trim() == heading.trim())
                //bug for h3 headers to fix
                if (headingTextEl.textContent.trim() == heading.trim() || headingTextEl.dataset.heading.trim() == heading.trim()) {
                    console.log("flash")
                    headingTextEl.addClass('is-flashing');
                    setTimeout(() => {
                        headingTextEl.removeClass('is-flashing');
                    }, 3000);
                    break;
                }
            }
        }
    }
}