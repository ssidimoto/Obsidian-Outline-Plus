import { Heading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import ExamplePlugin from "main";
import { App, Component, MarkdownView, } from "obsidian";
import { BehaviorSubject } from 'rxjs'

export const maxHeadingDepth = 6

export type TreeLatestChange = {
  id: number
  action: TreeAction
  heading: HeadingNode<Heading>
}

export enum TreeAction{
    add,
    delete,
    destroy,
    nothing
}

export class TreeFileViewModel{
    plugin: ExamplePlugin
    tree: HeadingsTree<Heading>
    id: number = 1
    nodeDict: Map<number, HeadingNode<Heading>> = new Map()

    private change = new BehaviorSubject<TreeLatestChange|null>(null)
    
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

        this.plugin.registerEvent(
            this.plugin.app.workspace.on('editor-change', editor => {
                let content = editor.getDoc().getValue()
                this.buildHeadingTree(content)
                console.log("change !")
                console.log(this.tree)
            })
        )

        this.plugin.registerEvent(
           this.plugin.app.workspace.on('active-leaf-change', async () => {
                const file = this.plugin.app.workspace.getActiveFile();
                console.log("a")
                if(file) {
                    const content = await this.plugin.app.vault.read(file)
                    this.buildHeadingTree(content)
                }
                
            })
        )
    }
    buildHeadingTree(doc: string): void {
        this.tree.root.childrens = []
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
            }
        });
    }

    getId(): number{
        return this.id++
    }

    headingOnClicked(id: number){
        
        // const file = this.plugin.app.workspace.getActiveViewOfType(MarkdownPreviewView)
        // this.plugin.app.workspace.ma

        // const highlightedHeadLine = "==" + headLine + "==";
        
        // const startPos: EditorPosition = { line: lineNbr, ch: depth + 1 };
        // const endPos: EditorPosition = { line: lineNbr, ch: depth + headLine.length + 1 };
        
        // // Highlight the heading
        // editor.replaceRange(highlightedHeadLine, startPos, endPos);
        // editor.scrollIntoView({ from: startPos, to: startPos }, true);
        
        // // Wait 3 seconds
        // await new Promise(resolve => setTimeout(resolve, 3000));
        
        // // Restore original heading
        // const restoreEndPos: EditorPosition = { line: lineNbr, ch: depth + highlightedHeadLine.length + 1 };
        // editor.replaceRange(headLine, startPos, restoreEndPos);
        // editor.setCursor(startPos);

        //these are not available. must find turnaround. 
        //this.app.workspace.getActiveFileView().previewMode.applyScroll(0) and 
        //this.app.workspace.getActiveFileView().editMode.applyScroll(0)
        
    }
}