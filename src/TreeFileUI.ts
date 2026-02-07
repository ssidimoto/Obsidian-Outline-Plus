import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { Heading, HtmlHeading } from "datatypes/Heading";
import { TreeFileViewModel } from "TreeFileViewModel";
import { maxHeadingDepth , TreeAction} from "TreeFileViewModel";
import { Head } from "rxjs";

export const HTMLCls = {
        HeadingContainer: "heading-container",
        heading: "heading",
        SubHeading: "sub-headings",
        HeadingButton: "heading-button",
        HeadingText: "heading-text"
    }


export class TreeFileUi{
    tree: HeadingsTree<HtmlHeading>
    nodeDict: Map<number, HeadingNode<HtmlHeading>> = new Map()
    viewModel: TreeFileViewModel
    container: HTMLElement


    constructor(viewModel: TreeFileViewModel, container: HTMLElement){
        this.viewModel = viewModel
        this.container = container
        this.init()
    }

    init(){
        // let TreeFilecontainer = this.container.createEl("div").createEl("div")
        // TreeFilecontainer.setAttribute("style", "width: 477px; height: 500px; margin-bottom: 0px;")

        let rootHeading = new Heading("Tree File Structure", Array(maxHeadingDepth).fill(0), 0)
        let rootHeadingNode = new HeadingNode(rootHeading, -1, 0)

        const rootHTMLHeadingNode = this.newNode(rootHeadingNode)
        this.container.insertAdjacentElement("beforeend", rootHTMLHeadingNode.data.FolderEl)
        this.tree = new HeadingsTree<HtmlHeading>(new HeadingNode(rootHTMLHeadingNode.data, -1, 0))

        this.viewModel.change$.subscribe((change) => {
            switch(change?.action) {
                case TreeAction.add:
                    if(change.node) this.addNode(this.newNode(change.node))
                    console.log("recieved add action")
                    break;
                case TreeAction.delete: //TODO
                case TreeAction.destroy:
                    this.tree.root.childrens = []
                    this.clearTreeHtml(this.tree.root.data)
                    console.log("recieved destroy action")
                    break;
                case TreeAction.nothing: //TODO

            }
        })
    }

    addNode(node: HeadingNode<HtmlHeading>){
        this.tree.addNode(node)
        this.nodeDict.set(node.id, node)
        this.addHTMLinChild(node.parent.data, node.data)
        node.parent.data.isItem = false
        node.parent.data.IconEl.setAttribute("style", "display: block;")
        console.log(node.parent.data.FolderEl)
    }

    addHTMLinChild(parent:HtmlHeading, child: HtmlHeading){
        parent.childrens.insertAdjacentElement("beforeend", child.FolderEl)
    }

    clearTreeHtml(node: HtmlHeading){
        Array.from(node.childrens.children).forEach(element => {
            const child = element as HTMLElement
            child.remove()
        });
    }
    newNode(node: HeadingNode<Heading>): HeadingNode<HtmlHeading>{
        console.log("creating new node")
        const folderEl = document.createElement("div");
        folderEl.className = "tree-item nav-folder";

        const folderSelf = document.createElement("div");
        folderSelf.className = "tree-item-self nav-folder-title is-clickable mod-collapsible";
        folderSelf.setAttribute("draggable", "true");
        folderSelf.setAttribute(
            "style",
            "margin-inline-start: 0px !important; padding-inline-start: 24px !important;"
        );

        const iconContainer = document.createElement("div");
        iconContainer.className = "tree-item-icon collapse-icon";
        if(node.childrens.length == 0){
            iconContainer.setAttribute(
                "style",
                "display: none;"
            );
        }

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("width", "24");
        svg.setAttribute("height", "24");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("class", "svg-icon right-triangle");

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M3 8L12 17L21 8");
        svg.appendChild(path);
        iconContainer.appendChild(svg);

        const titleEl = document.createElement("div");
        titleEl.className = "tree-item-inner nav-folder-title-content";
        titleEl.setAttribute("data-initialized", "true");
        titleEl.textContent = node.data.headLine;

        const children = document.createElement("div")
        children.className = "tree-item-children nav-folder-children"
        children.createDiv().setAttribute(
            "style",
            "width: 460px; height: 0.1px; margin-bottom: 0px;"
        )
        folderSelf.appendChild(iconContainer);
        folderSelf.appendChild(titleEl);
        folderEl.appendChild(folderSelf);
        folderEl.appendChild(children);
        const htmlHeading = new HtmlHeading(folderEl, titleEl, iconContainer,  children, false, node.data.index)
        const headingNode = new HeadingNode<HtmlHeading>(htmlHeading, node.depth, node.id)

        iconContainer.addEventListener('click', (e) => {
            this.viewModel.OnHeadingButtonClicked(htmlHeading)
        })

        titleEl.addEventListener('click', (e) => {
            this.viewModel.OnHeadingClicked(headingNode.id)
        })
        return headingNode
    }
}

