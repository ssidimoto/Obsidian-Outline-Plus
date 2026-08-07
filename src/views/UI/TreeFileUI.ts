import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { Heading, HtmlHeading } from "datatypes/Heading";
import { TreeFileViewModel, TreeAction } from "views/ViewModel/TreeFileViewModel";
import { Subscription } from "rxjs";

/** UI builder for the headings tree. */
export class TreeFileUi {
    tree!: HeadingsTree<HtmlHeading>;
    nodeDict: Map<number, HeadingNode<HtmlHeading>> = new Map();
    viewModel: TreeFileViewModel;
    container: HTMLElement;
    hooveredNode: HeadingNode<HtmlHeading> | undefined = undefined;
    private changeSubscription?: Subscription;

    /** Create the UI for the headings tree.
     * @param viewModel View model that provides tree updates.
     * @param container Root element to render into.
     */
    constructor(viewModel: TreeFileViewModel, container: HTMLElement) {
        this.viewModel = viewModel;
        this.container = container;
        this.init();
    }

    /** Initialize root node and subscribe to model changes. */
    init() {
        console.debug("TreeFileUi initialized");

        const rootHeading = new Heading("Tree File Structure", 0, 0);
        const rootHeadingNode = new HeadingNode(rootHeading, -1, 0);

        const rootHTMLHeadingNode = this.newNode(rootHeadingNode);
        this.container.appendChild(rootHTMLHeadingNode.data.FolderEl);

        this.tree = new HeadingsTree<HtmlHeading>(rootHTMLHeadingNode);
        this.nodeDict.set(rootHTMLHeadingNode.id, rootHTMLHeadingNode);

        this.changeSubscription = this.viewModel.change$.subscribe((change) => {
            switch (change?.action) {
                case TreeAction.add:
                    if (change.node) {
                        this.addNode(this.newNode(change.node as HeadingNode<Heading>));
                    }
                    break;
                case TreeAction.delete:
                    if (change.node) {
                        this.deleteNode(change.node as number);
                    }
                    break;
                case TreeAction.destroy:
                    this.destroyTree();
                    break;
                case TreeAction.scrolled:
                    if (change.node) {
                        this.scrollToLine(change.node as number);
                    }
                    break;
                default:
                    break;
            }
        });
    }

    scrollToLine(lineNbr: number): void {
        // Reset previously highlighted element
        if (this.hooveredNode) {
            const previousEl = this.hooveredNode.data.IconEl.parentElement;

            if (previousEl) {
                previousEl.style.backgroundColor = "";
                previousEl.style.color = "";
                previousEl.style.transform = "";
            }
        }

        const closestNode = this.tree.findClosestNode(lineNbr);
        if (!closestNode) {
            return;
        }

        // Scroll into view
        closestNode.data.TitleEl.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });

        // Apply highlight
        const element = closestNode.data.IconEl.parentElement;
        if (element) {
            element.style.backgroundColor = "#4d4d4d";
            element.style.transform = "scale(1.05)";
        }

        this.hooveredNode = closestNode;
    }

    /** Add a node to the UI tree.
     * @param node HtmlHeading node to insert.
     */
    addNode(node: HeadingNode<HtmlHeading>) {
        this.tree.addNode(node);
        this.nodeDict.set(node.id, node);

        if (node.parent) {
            this.addHTMLinChild(node.parent, node);
            node.parent.data.isItem = false;
            node.parent.data.IconEl.style.display = "block";
        }
    }

    /** Remove a node from the UI and tree model.
     * @param nodeId ID of the node to remove.
     */
    deleteNode(nodeId: number) {
        const node = this.nodeDict.get(nodeId);
        if (!node) return;

        const parentNode = node.parent;

        // Remove DOM element
        node.data.FolderEl.remove();

        // Update Tree Data Structure & Dictionary
        this.tree.removeNode(node);
        this.nodeDict.delete(nodeId);

        // If parent has no remaining children, hide collapse icon
        if (parentNode && parentNode.childrens.length === 0) {
            parentNode.data.isItem = true;
            parentNode.data.IconEl.style.display = "none";
        }
    }

    /** Reset and destroy all elements in the tree. */
    destroyTree() {
        this.tree.root.childrens = [];
        this.clearTreeHtml(this.tree.root.data);
        this.nodeDict.clear();
        this.nodeDict.set(this.tree.root.id, this.tree.root);
    }

    /** Insert child heading DOM element maintaining sorted sibling position.
     * @param parentNode Parent HeadingNode.
     * @param childNode Child HeadingNode to insert.
     */
    addHTMLinChild(parentNode: HeadingNode<HtmlHeading>, childNode: HeadingNode<HtmlHeading>) {
        const parentHtml = parentNode.data;
        const childHtml = childNode.data;

        // Determine correct DOM placement based on node sibling index
        const siblings = parentNode.childrens;
        const index = siblings.indexOf(childNode);

        if (index >= 0 && index < siblings.length - 1) {
            const nextSibling = siblings[index + 1]!;
            parentHtml.childrens.insertBefore(childHtml.FolderEl, nextSibling.data.FolderEl);
        } else {
            parentHtml.childrens.appendChild(childHtml.FolderEl);
        }
    }

    /** Remove all rendered child nodes from a heading.
     * @param node The heading whose children should be cleared.
     */
    clearTreeHtml(node: HtmlHeading) {
        while (node.childrens.firstChild) {
            node.childrens.removeChild(node.childrens.firstChild);
        }
    }

    /** Create an HtmlHeading node for rendering.
     * @param node Source heading data node.
     */
    newNode(node: HeadingNode<Heading>): HeadingNode<HtmlHeading> {
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
        if (node.childrens.length === 0) {
            iconContainer.style.display = "none";
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

        const children = document.createElement("div");
        children.className = "tree-item-children nav-folder-children";
        // if(node.depth > 1) {
        //     this.animateCollapse
        // }

        const spacer = document.createElement("div");
        spacer.setAttribute("style", "width: 460px; height: 0.1px; margin-bottom: 0px;");
        children.appendChild(spacer);

        folderSelf.appendChild(iconContainer);
        folderSelf.appendChild(titleEl);
        folderEl.appendChild(folderSelf);
        folderEl.appendChild(children);

        const htmlHeading = new HtmlHeading(
            folderEl,
            titleEl,
            iconContainer,
            children,
            false,
            node.data.lineNbr,
            (node.data as any).width ?? 0
        );
        const headingNode = new HeadingNode<HtmlHeading>(htmlHeading, node.depth, node.id);

        iconContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            this.OnHeadingButtonClicked(htmlHeading);
        });

        folderEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this.viewModel.OnHeadingClicked(headingNode.id);
        });

        return headingNode;
    }

    /** Toggle a heading node's expanded/collapsed state in the UI.
     * @param node The heading UI node to toggle.
     */
    OnHeadingButtonClicked(node: HtmlHeading) {
        const childrenEl = node.childrens as HTMLElement;

        if (node.IconEl.classList.contains("is-collapsed")) {
            node.IconEl.classList.remove("is-collapsed");
            node.FolderEl.appendChild(childrenEl);
            this.animateExpand(childrenEl);
        } else {
            node.IconEl.classList.add("is-collapsed");
            this.animateCollapse(childrenEl);
        }
    }

    private animateCollapse(childrenEl: HTMLElement) {
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

    private animateExpand(childrenEl: HTMLElement) {
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

    private recursiveCollapse(node: HeadingNode<HtmlHeading>) {
        node.data.IconEl.classList.add("is-collapsed");
        node.data.childrens.style.display = "none";
        node.childrens.forEach((child) => {
            this.recursiveCollapse(child);
        });
    }

    private recursiveExpand(node: HeadingNode<HtmlHeading>) {
        node.data.IconEl.classList.remove("is-collapsed");
        node.data.childrens.style.display = "block";
        node.childrens.forEach((child) => {
            this.recursiveExpand(child);
        });
    }

    /** Clean up subscriptions when the UI is destroyed. */
    destroy() {
        this.changeSubscription?.unsubscribe();
    }


}