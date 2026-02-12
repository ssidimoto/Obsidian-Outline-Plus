import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { Heading, HtmlHeading } from "datatypes/Heading";
import { TreeFileViewModel } from "views/ViewModel/TreeFileViewModel";
import { maxHeadingDepth , TreeAction} from "views/ViewModel/TreeFileViewModel";

/** UI builder for the headings tree. */
export class TreeFileUi{
    tree: HeadingsTree<HtmlHeading>
    nodeDict: Map<number, HeadingNode<HtmlHeading>> = new Map()
    viewModel: TreeFileViewModel
    container: HTMLElement


    /** Create the UI for the headings tree.
     * @param viewModel View model that provides tree updates.
     * @param container Root element to render into.
     */
    constructor(viewModel: TreeFileViewModel, container: HTMLElement){
        this.viewModel = viewModel
        this.container = container
        this.init()
    }

    /** Initialize root node and subscribe to model changes. */
    init(){
        console.debug("TreeFileUi initialized");

        let rootHeading = new Heading("Tree File Structure", 0, 0)
        let rootHeadingNode = new HeadingNode(rootHeading, -1, 0)

        const rootHTMLHeadingNode = this.newNode(rootHeadingNode)
        this.container.insertAdjacentElement("beforeend", rootHTMLHeadingNode.data.FolderEl)
        this.tree = new HeadingsTree<HtmlHeading>(new HeadingNode(rootHTMLHeadingNode.data, -1, 0))

        this.viewModel.change$.subscribe((change) => {
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

    /** Add a node to the UI tree.
     * @param node HtmlHeading node to insert.
     */
    addNode(node: HeadingNode<HtmlHeading>){
        this.tree.addNode(node)
        this.nodeDict.set(node.id, node)
        this.addHTMLinChild(node.parent.data, node.data)
        node.parent.data.isItem = false
        node.parent.data.IconEl.setAttribute("style", "display: block;")
    }

    /** Append a child heading element into its parent.
     * @param parent Parent heading element.
     * @param child Child heading element.
     */
    addHTMLinChild(parent:HtmlHeading, child: HtmlHeading){
        parent.childrens.insertAdjacentElement("beforeend", child.FolderEl)
    }

    /** Remove all rendered child nodes from a heading.
     * @param node The heading whose children should be cleared.
     */
    clearTreeHtml(node: HtmlHeading){
        Array.from(node.childrens.children).forEach(element => {
            const child = element as HTMLElement
            child.remove()
        });
    }
    /** Create an HtmlHeading node for rendering.
     * @param node Source heading data node.
     */
    newNode(node: HeadingNode<Heading>): HeadingNode<HtmlHeading>{
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
        const htmlHeading = new HtmlHeading(folderEl, titleEl, iconContainer,  children, false, node.data.lineNbr, node.data.width)
        const headingNode = new HeadingNode<HtmlHeading>(htmlHeading, node.depth, node.id)

        iconContainer.addEventListener('click', (e) => {
            e.stopPropagation()
            this.OnHeadingButtonClicked(htmlHeading)
        })

        folderEl.addEventListener('click', (e) => {
            e.stopPropagation()
            this.viewModel.OnHeadingClicked(headingNode.id)
        })
        return headingNode
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

