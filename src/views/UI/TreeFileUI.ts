import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { renderMath, finishRenderMath } from "obsidian";
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

    constructor(viewModel: TreeFileViewModel, container: HTMLElement) {
        this.viewModel = viewModel;
        this.container = container;
        this.init();
    }

    init() {
        const rootHeading = new Heading("File Index", 0, 0);
        const rootHeadingNode = new HeadingNode(rootHeading, -1, 0);

        const rootHTMLHeadingNode = this.newNode(rootHeadingNode);
        rootHTMLHeadingNode.data.childrens.style = "border-inline-start: none;";
        this.container.appendChild(rootHTMLHeadingNode.data.FolderEl);

        this.tree = new HeadingsTree<HtmlHeading>(rootHTMLHeadingNode);
        this.nodeDict.set(rootHTMLHeadingNode.id, rootHTMLHeadingNode);

        this.changeSubscription = this.viewModel.change$.subscribe((change) => {
            switch (change?.action) {
                case TreeAction.add:
                    if (change.node) this.addNode(this.newNode(change.node as HeadingNode<Heading>));
                    break;
                case TreeAction.delete:
                    if (change.node) this.deleteNode(change.node as number);
                    break;
                case TreeAction.destroy:
                    this.destroyTree();
                    break;
                case TreeAction.scrolled:
                    if (change.node !== undefined && change.node !== null) this.scrollToLine(change.node as number);
                    break;
                default:
                    break;
            }
        });
    }

    scrollToLine(lineNbr: number): void {
        const closestNode = this.tree.findClosestNode(lineNbr);
        if (!closestNode) return;
        
        // Optimisation : on ne refait rien si on est déjà sur le bon nœud
        if (this.hooveredNode === closestNode) return; 

        // 1. Reset previously highlighted element
        if (this.hooveredNode) {
            const previousEl = this.hooveredNode.data.IconEl.parentElement;
            if (previousEl) {
                previousEl.style.backgroundColor = "";
                previousEl.style.transform = "";
            }
        }

        // 2. Déplier automatiquement tous les parents pour rendre le nœud visible
        this.expandPathToNode(closestNode);

        // 3. Auto-Collapse de l'ancienne branche si on est sorti de sa hiérarchie
        if (
            this.hooveredNode &&
            !this.hooveredNode.data.FolderEl.contains(closestNode.data.FolderEl) &&
            !closestNode.data.FolderEl.contains(this.hooveredNode.data.FolderEl)
        ) {
            let nodeToCollapse: HeadingNode<HtmlHeading> | undefined = this.hooveredNode;
            
            // Remonter dans l'arbre en toute sécurité jusqu'à atteindre un niveau de profondeur pertinent
            while (nodeToCollapse && nodeToCollapse.parent && nodeToCollapse.depth > closestNode.depth) {
                nodeToCollapse = nodeToCollapse.parent;
            }

            // Fermer le nœud sans crasher sur la racine
            if (nodeToCollapse && nodeToCollapse.id !== this.tree.root.id) {
                if (!nodeToCollapse.data.IconEl.classList.contains("is-collapsed")) {
                    this.OnHeadingButtonClicked(nodeToCollapse.data);
                }
            }
        }
        // 4. Scroll into view
        closestNode.data.TitleEl.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });

        // 5. Apply highlight
        const element = closestNode.data.IconEl.parentElement;
        if (element) {
            element.style.backgroundColor = "var(--background-modifier-hover)"; // Utilise la couleur du thème Obsidian
            element.style.transform = "scale(1.05)";
            element.style.transition = "transform 150ms ease, background-color 150ms ease";
        }

        this.hooveredNode = closestNode;
    }

    addNode(node: HeadingNode<HtmlHeading>) {
        this.tree.addNode(node);
        this.nodeDict.set(node.id, node);

        if (node.parent) {
            this.addHTMLinChild(node.parent, node);
            node.parent.data.isItem = false;
            node.parent.data.IconEl.style.display = "block";
        }
    }

    deleteNode(nodeId: number) {
        const node = this.nodeDict.get(nodeId);
        if (!node) return;

        const parentNode = node.parent;
        node.data.FolderEl.remove();
        this.tree.removeNode(node);
        this.nodeDict.delete(nodeId);

        if (parentNode && parentNode.childrens.length === 0) {
            parentNode.data.isItem = true;
            parentNode.data.IconEl.style.display = "none";
        }
    }

    destroyTree() {
        this.tree.root.childrens = [];
        this.clearTreeHtml(this.tree.root.data);
        this.nodeDict.clear();
        this.nodeDict.set(this.tree.root.id, this.tree.root);
    }

    addHTMLinChild(parentNode: HeadingNode<HtmlHeading>, childNode: HeadingNode<HtmlHeading>) {
        const parentHtml = parentNode.data;
        const childHtml = childNode.data;
        const siblings = parentNode.childrens;
        const index = siblings.indexOf(childNode);

        if (index >= 0 && index < siblings.length - 1) {
            const nextSibling = siblings[index + 1]!;
            parentHtml.childrens.insertBefore(childHtml.FolderEl, nextSibling.data.FolderEl);
        } else {
            parentHtml.childrens.appendChild(childHtml.FolderEl);
        }
    }

    clearTreeHtml(node: HtmlHeading) {
        while (node.childrens.firstChild) {
            node.childrens.removeChild(node.childrens.firstChild);
        }
    }

    newNode(node: HeadingNode<Heading>): HeadingNode<HtmlHeading> {
        const folderEl = document.createElement("div");
        folderEl.className = "tree-item nav-folder";

        const folderSelf = document.createElement("div");
        folderSelf.className = "tree-item-self nav-folder-title is-clickable mod-collapsible";
        folderSelf.setAttribute("draggable", "true");
        folderSelf.setAttribute("style", "margin-inline-start: 0px !important; padding-inline-start: 24px !important;");

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
        this.renderHeadingTitle(titleEl, node.data.headLine);

        const children = document.createElement("div");
        children.className = "tree-item-children nav-folder-children";

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
        
        // Collapse statique à l'initialisation (sans animations)
        if (node.depth > 1) {
            iconContainer.classList.add("is-collapsed");
            children.remove();
        }

        const headingNode = new HeadingNode<HtmlHeading>(htmlHeading, node.depth, node.id);

        iconContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            this.OnHeadingButtonClicked(htmlHeading);
        });

        folderEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this.viewModel.OnHeadingClicked(headingNode.id);
            if(headingNode.data.IconEl.classList.contains("is-collapsed")) {
                this.OnHeadingButtonClicked(headingNode.data);
            }

        });

        return headingNode;
    }

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
        const startHeight = childrenEl.scrollHeight;
        childrenEl.style.overflow = "hidden";
        childrenEl.style.height = `${startHeight}px`;
        childrenEl.style.transition = "height 150ms ease";
        
        void childrenEl.offsetHeight; // Force reflow
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
        
        // ATTENTION : J'ai supprimé ici le bloc "if(childrenEl.childElementCount <= 1)" 
        // car il cassait l'animation en supprimant l'élément avant la fin de la transition.
    }

    private animateExpand(childrenEl: HTMLElement) {
        const targetHeight = childrenEl.scrollHeight;
        childrenEl.style.overflow = "hidden";
        childrenEl.style.height = "0px";
        childrenEl.style.transition = "height 150ms ease";
        
        void childrenEl.offsetHeight; // Force reflow
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

    /** 
     * Remplacement de recursiveExpand :
     * Ouvre les PARENTS du nœud ciblé pour qu'il devienne visible.
     */
    private expandPathToNode(node: HeadingNode<HtmlHeading>) {
        let current: HeadingNode<HtmlHeading> | undefined = node.parent;
        const nodesToExpand: HeadingNode<HtmlHeading>[] = [];

        // Récupérer tous les parents actuellement fermés
        while (current && current.id !== this.tree.root.id) {
            if (current.data.IconEl.classList.contains("is-collapsed")) {
                nodesToExpand.push(current);
            }
            current = current.parent;
        }

        // Les ouvrir de haut en bas (du plus grand parent au plus petit)
        // C'est indispensable pour que le scrollHeight se calcule correctement dans animateExpand !
        for (let i = nodesToExpand.length - 1; i >= 0; i--) {
            this.OnHeadingButtonClicked(nodesToExpand[i]!.data);
        }
    }

    destroy() {
        this.changeSubscription?.unsubscribe();
    }


/**
 * Renders a heading string containing inline LaTeX $...$ into a container element.
 */
    private renderHeadingTitle(containerEl: HTMLElement, titleText: string): void {
    containerEl.empty();
    if (!titleText) return;

    const mathRegex = /\$([^\$]+)\$/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mathRegex.exec(titleText)) !== null) {
        if (match.index > lastIndex) {
            containerEl.appendText(titleText.slice(lastIndex, match.index));
        }

        const mathContent = match[1]!;
        const mathEl = renderMath(mathContent, true);
        
        // Force inline rendering
        mathEl.style.display = "inline-block";
        mathEl.style.verticalAlign = "middle";
        mathEl.style.margin = "0 2px";

        containerEl.appendChild(mathEl);
        lastIndex = mathRegex.lastIndex;
    }

    if (lastIndex < titleText.length) {
        containerEl.appendText(titleText.slice(lastIndex));
    }

    finishRenderMath();
}
}