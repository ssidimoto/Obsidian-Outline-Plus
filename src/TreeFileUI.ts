import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { Heading, htmlHeading } from "datatypes/Heading";
import { TreeFileViewModel } from "TreeFileViewModel";
import { maxHeadingDepth , TreeAction} from "TreeFileViewModel";

export const HTMLCls = {
        HeadingContainer: "heading-container",
        heading: "heading",
        SubHeading: "sub-headings",
        HeadingButton: "heading-button",
        HeadingText: "heading-text"
    }


export class TreeFileUi{
    tree: HeadingsTree<htmlHeading>
    nodeDict: Map<number, HeadingNode<htmlHeading>> = new Map()
    viewModel: TreeFileViewModel
    container: HTMLElement


    constructor(viewModel: TreeFileViewModel, container: HTMLElement){
        this.viewModel = viewModel
        this.container = container
        this.init() 
    }

    init(){
        //create root node
        let rootHeadingContainer = this.container.createDiv({cls: HTMLCls.HeadingContainer});
        let rootHeadingDiv = rootHeadingContainer.createDiv({cls: HTMLCls.heading});
        rootHeadingDiv.createEl('div', {text: "Tree File Structure", cls: HTMLCls.HeadingText})
        let rootSubHeading = rootHeadingContainer.createDiv({cls: HTMLCls.SubHeading});
        let rootHTMLHeading = new htmlHeading(rootHeadingContainer, rootHeadingDiv, rootSubHeading, false, Array(maxHeadingDepth).fill(0))
        let htmlHeadingNode = new HeadingNode<htmlHeading>(rootHTMLHeading, -1, 0)
        this.tree = new HeadingsTree<htmlHeading>(htmlHeadingNode)

        this.viewModel.change$.subscribe((change) => {
            console.log(change)
            switch(change?.action) {
                case TreeAction.add:
                    if(change.node) this.addNode(this.newNode(change.node))
                    break;
                case TreeAction.delete: //TODO
                case TreeAction.destroy: 
                    this.tree.root.childrens = [] 
                    this.clearTreeHtml(this.tree.root.data)
                    break;
                case TreeAction.nothing: //TODO

            }
        })
    }

    addNode(node: HeadingNode<htmlHeading>){
        this.tree.addNode(node)
        this.nodeDict.set(node.id, node)
        this.addHTMLinChild(node.parent.data, node.data)
    }

    newNode(node: HeadingNode<Heading>){
        let root = document.createElement('div')
        let headingContainer = root.createEl('div', {cls: HTMLCls.HeadingContainer})
        let headingDiv = headingContainer.createDiv({cls: HTMLCls.heading})
        let button = headingDiv.createEl('button', {text: '>', cls: HTMLCls.HeadingButton})
        let subHeading = headingContainer.createDiv({cls: HTMLCls.SubHeading})
        subHeading.hidden = true
        let text = headingDiv.createEl('div', {text: node.data.headLine, cls: HTMLCls.HeadingText})
        let newHeading = new htmlHeading(headingContainer, headingDiv, subHeading, false,  node.data.index)

        text.addEventListener('click', () => {
            this.viewModel.OnHeadingClicked(node.id)
        })

        button.addEventListener('click', () => {
            this.viewModel.OnHeadingButtonClicked(newHeading)
        })
        
        return new HeadingNode<htmlHeading>(newHeading, node.depth, node.id)
    }

    newHtmlHeading(heading: Heading, index: number[]): htmlHeading{
        let root = document.createElement('div')
        let headingContainer = root.createEl('div', {cls: HTMLCls.HeadingContainer})
        let headingDiv = headingContainer.createDiv({cls: HTMLCls.heading})
        let button = headingDiv.createEl('button', {text: '>', cls: HTMLCls.HeadingButton})
        let subHeading = headingContainer.createDiv({cls: HTMLCls.SubHeading})
        subHeading.hidden = true
        let text = headingDiv.createEl('div', {text: heading.headLine, cls: HTMLCls.HeadingText})
        let newHeading = new htmlHeading(headingContainer, headingDiv, subHeading, false,  index)

        text.addEventListener('click', () => {
            this.viewModel.OnHeadingClicked(heading.lineNbr)
        })

        button.addEventListener('click', () => {
            this.viewModel.OnHeadingButtonClicked(newHeading)
        })

        return newHeading
    }

    addHTMLinChild(parent:htmlHeading, child: htmlHeading){
        parent.subHeading.insertAdjacentElement("beforeend", child.headingContainer)
    }

    clearTreeHtml(node: htmlHeading){
        Array.from(node.subHeading.children).forEach(element => {
            const child = element as HTMLElement
            child.remove()
        });
        console.log("clear")
        console.log(this.tree)
    }
}

