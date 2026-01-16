import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { htmlHeading } from "datatypes/Heading";
import { TreeFileViewModel } from "HeadingTreeViewModel";
import { maxHeadingDepth , TreeAction} from "HeadingTreeViewModel";

export const HTMLCls = {
        HeadingContainer: "heading-container",
        heading: "heading",
        SubHeading: "sub-headings",
        HeadingButton: "heading-button",
        HeadingText: "heading-text"
    }


export class HeadingTreeUi{
    tree: HeadingsTree<htmlHeading>
    nodeDict: Map<number, HeadingNode<htmlHeading>> = new Map()
    viewModel: TreeFileViewModel
    container: HTMLElement

    constructor(viewModel: TreeFileViewModel, container: HTMLElement){
        this.viewModel = viewModel
        this.init() 
    }

    init(){
        let rootHeadingContainer = this.container.createDiv({cls: HTMLCls.HeadingContainer});
        let rootHeadingHeading = rootHeadingContainer.createDiv({cls: HTMLCls.heading});
        let rootSubHeading = rootHeadingContainer.createDiv({cls: HTMLCls.SubHeading});
        let rootHTMLHeading = new htmlHeading(rootHeadingContainer, rootHeadingHeading, rootSubHeading, false, Array(maxHeadingDepth).fill(0))
        let htmlHeadingNode = new HeadingNode<htmlHeading>(rootHTMLHeading, -1, 0)
        this.tree = new HeadingsTree<htmlHeading>(htmlHeadingNode)

        this.viewModel.change$.subscribe((change) => {
            switch(change?.action) {
                case TreeAction.add: //TODO
                case TreeAction.delete: //TODO
                case TreeAction.destroy: //TODO
                case TreeAction.nothing: //TODO

            }
        })

    }

    newNode(){
        //TODO
    }

    newHtmlHeading(){
        //TODO
    }
}