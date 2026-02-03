import { Heading, htmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import ExamplePlugin from "main";
import { App, Component, Editor, EditorPosition, MarkdownView, } from "obsidian";
import { off } from "process";
import { BehaviorSubject, Head } from 'rxjs'
import { similarity } from "services/helper";

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
        console.log("builed tree")
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

    async OnHeadingClicked(id: number){
        const fileView = (this.plugin.app.workspace as any).getActiveFileView();
        const node = this.nodeDict.get(id)
        if(node == undefined){
            throw Error("this node does not exist")
        }

        let view = fileView.currentMode
        if(view.type == "preview" || view.type == "source" ){
            view.applyScroll(node?.data.lineNbr - topLinePadding)
            await new Promise(resolve => setTimeout(resolve, 100))
            let elem: Element | undefined

            if(view.type == "preview"){
                elem = this.getElementPreview(node, fileView.containerEl, fileView.editMode.editor)
            }else{
                elem = this.getElementEdit(node, fileView.containerEl, fileView.editMode.editor)
            }

            elem?.addClass('is-flashing');
            setTimeout(() => {
                elem?.removeClass('is-flashing');
            }, 3000);
        }
    }
    OnHeadingButtonClicked(node: htmlHeading){
       node.subHeading.hidden = !node.subHeading.hidden
    }

    private cleanLatex(text: string): string {
        return text.replace(LATEX_REGEX, "").trim();
    }

    private calculateSiblingScore(
        node: HeadingNode<Heading>,
        editor: Editor,
        offsets: number[],
        direction: 'next' | 'prev',
        elem: Element,
        nextSibling : (elem: Element, offset: number) => Element|null
    ): number {
        let bestScore = 0;

        for (const offset of offsets) {
            
            const siblingText = nextSibling(elem, offset)?.textContent || ""
            const lineNbr = node.data.lineNbr + offset;
            if (lineNbr < 0 || lineNbr >= editor.lineCount()) continue;

            const editorLine = this.cleanLatex(editor.getLine(lineNbr));
            const truncatedText = direction === 'next'
                ? siblingText.substring(0, editorLine.length)
                : siblingText.substring(siblingText.length - editorLine.length);
            console.log(`offset : ${offset}, ${editorLine} vs ${siblingText}`)
            if (editorLine === "" && truncatedText === "") continue;

            const score = similarity(editorLine, truncatedText);
            console.log(`score-offset : ${score}`)
            bestScore = Math.max(bestScore, score);
        }

        return bestScore;
    }

    private calculateTotalSiblingScore(
        element: HTMLElement,
        node: HeadingNode<Heading>,
        editor: Editor,
        nextSibling : (elem: Element, offset: number) => Element|null
    ): number {
        const parent = element.parentElement;
        const nextScore = this.calculateSiblingScore(
            node,
            editor,
            [1, 2],
            'next',
            element,
            nextSibling
        );
        const prevScore = this.calculateSiblingScore(
            node,
            editor,
            [-1, -2],
            'prev',
            element,
            nextSibling
        );
        return nextScore + prevScore;
    }

    private findBestMatch(
        elements: NodeListOf<Element>,
        node: HeadingNode<Heading>,
        editor: Editor,
        matchFn: (el: HTMLElement) => boolean,
        nextSibling : (elem: Element, offset: number) => Element|null
    ): HTMLElement | undefined {
        let bestMatch: { element: HTMLElement; score: number } | null = null;
        console.log(`# matches : ${elements.length}`)
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            if (!matchFn(el)) continue;
            console.log(`elem ${i}`)
            const score = this.calculateTotalSiblingScore(el, node, editor, nextSibling);
            if (bestMatch === null || score > bestMatch.score) {
                bestMatch = { element: el, score };
            }
        }
        return bestMatch?.element;
    }

    getElementPreview(node: HeadingNode<Heading>, containerEl: Element, editor: Editor): HTMLElement | undefined {
        console.log("preview")
        const lineElements = containerEl.querySelectorAll(`h${node.depth + 1}`);
        if (lineElements.length === 0) return;

        return this.findBestMatch(lineElements, node, editor, (el) => {
            return el.dataset.heading?.trim() === node.data.headLine.trim();
            }, 
            (elem: Element, offset: number) => {
                return elem.parentElement?.nextElementSibling || null
            }
        );
    }

    getElementEdit(node: HeadingNode<Heading>, containerEl: Element, editor: Editor): HTMLElement | undefined {
        console.log("edit")
        const lineElements = containerEl.querySelectorAll(`.cm-header-${node.depth + 1}`);
        const parentElem = Array.from(lineElements, (elem) => elem.parentElement);
        if (lineElements.length === 0) return;

        const cleanedHeadLine = this.cleanLatex(node.data.headLine);
        return this.findBestMatch(lineElements, node, editor, (el) => {
            return el.textContent?.trim() === cleanedHeadLine;
        }, (elem: Element, offset: number) => {
            let currElem: Element|null = elem.parentElement
            if(offset > 0) {
                for(let i=0; i<offset; i++){
                    currElem = currElem?.nextElementSibling || null
                }
            }else{  
                for(let i=0; i>offset; i--){
                    currElem = currElem?.previousElementSibling || null
                }
            }
            console.log(currElem)
            return currElem
        });
    }
}