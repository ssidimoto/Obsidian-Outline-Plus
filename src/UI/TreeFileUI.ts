import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { renderMath, finishRenderMath } from "obsidian";
import { Heading, HtmlHeading } from "datatypes/Heading";
import { TreeFileViewModel, TreeAction, ParamUpdateAction } from "views/ViewModel/TreeFileViewModel";
import { Subscription } from "rxjs";
import { expandPathToNode, animateCollapse, animateExpand, collapsePathToNode, expandSubtree, collapseSubtree } from "./Animation";
import { createContextMenuUI, createGearIcon } from "./ParametersUI";
import { SETTINGS } from "../main";

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

        this.createRootNode();
        this.changeSubscription = this.viewModel.change$.subscribe((change) => {
            switch (change?.action) {
                case TreeAction.add:
                    if (change.node) this.addNode(this.newNode(change.node as HeadingNode<Heading>));
                    break;
                case TreeAction.delete:
                    this.deleteNode(change.node as number);
                    break;
                case TreeAction.destroy:
                    this.removeError();
                    this.destroyTree();

                    break;
                case TreeAction.scrolled:
                    if (change.node !== undefined && change.node !== null) this.scrollToLine(change.node as number);
                    break;
                case TreeAction.Error:
                    this.destroyTree();
                    this.error();
                default:
                    break;
            }
        });
    }

    createRootNode() {
        const rootHeading = new Heading("File Outline", 0, 0);
        const rootHeadingNode = new HeadingNode(rootHeading, -1, 0);

        const rootHTMLHeadingNode = this.newNode(rootHeadingNode);
        rootHTMLHeadingNode.data.childrens.style = "border-inline-start: none;";
        this.container.appendChild(rootHTMLHeadingNode.data.FolderEl);
        rootHTMLHeadingNode.data.IconEl.parentElement?.append(createGearIcon((action: ParamUpdateAction, val: number) => this.viewModel.onChange(action, val)));
        rootHTMLHeadingNode.data.IconEl.parentElement!.style.display = "flex";
        rootHTMLHeadingNode.data.IconEl.parentElement!.style.alignItems = "center";
        rootHTMLHeadingNode.data.IconEl.parentElement!.style.width = "100%";
        rootHTMLHeadingNode.data.TitleEl.style.flex = "1 1 auto";
        this.tree = new HeadingsTree<HtmlHeading>(rootHTMLHeadingNode);
        this.nodeDict.set(rootHTMLHeadingNode.id, rootHTMLHeadingNode);
    }

    error(){
        let css = 
        `position: absolute; top: 
        50%; left: 50%; transform: translate(-50%, -50%); font-size: 14px; 
        color: var(--text-normal); color: #909090;`

        this.container.empty();
        const wrapper = document.createElement("div");
        wrapper.style.cssText = css;
        const errorEl = document.createElement("div");
        //append child with text error : 
        let error = document.createElement("div");
        error.innerHTML = "Error :"
        wrapper.appendChild(error);
        wrapper.appendChild(document.createElement("r"));
        errorEl.textContent = "No compatible file found."
        wrapper.appendChild(errorEl);
        wrapper.appendChild(document.createElement("br"));
        const errorEl2 = document.createElement("div");
        errorEl2.textContent = "Please open a Markdown file to use the File Outline view."
        wrapper.appendChild(errorEl2);
        this.container.appendChild(wrapper);
    }

    removeError() {
        this.container.empty();
        this.createRootNode();

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
        expandPathToNode(closestNode, this.tree, (heading: HtmlHeading) => {
            this.OnHeadingButtonClicked(heading);
        });

        // 3. Auto-Collapse de l'ancienne branche si on est sorti de sa hiérarchie
        if (
            this.hooveredNode &&
            !this.hooveredNode.childrens.contains(closestNode) 
        ) {
            let nodeToCollapse: HeadingNode<HtmlHeading> | undefined = this.hooveredNode;
            
            // Remonter dans l'arbre en toute sécurité jusqu'à atteindre un niveau de profondeur pertinent
            while (nodeToCollapse && nodeToCollapse.parent && nodeToCollapse.depth > closestNode.depth               
            ) {
                nodeToCollapse = nodeToCollapse.parent;
            }

            // Fermer le nœud sans crasher sur la racine
            if (!nodeToCollapse.data.IconEl.classList.contains("is-collapsed")) {
                collapsePathToNode(nodeToCollapse, (heading: HtmlHeading) => {
                    this.OnHeadingButtonClicked(heading);
                }, closestNode.depth);
            }
            
        }
        // 4. Scroll into view
        closestNode.data.TitleEl.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
        if(closestNode.data.IconEl.classList.contains("is-collapsed")) {
            expandPathToNode(closestNode, this.tree, (heading: HtmlHeading) => {
                this.OnHeadingButtonClicked(heading);
            });
        }
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

        //add all its child and remove them from current node parent
        if(node.childrens.length > 0) {
            node.childrens.forEach((child) => {
                this.addHTMLinChild(node, child);
            });
            node.data.isItem = false;
            node.data.IconEl.style.display = "block";
        }

        //if prev sibling no more child remove its icon
        let prevSibling = node.parent?.childrens[node.parent.childrens.indexOf(node) - 1];
        if (prevSibling && prevSibling.childrens.length === 0) {
            prevSibling.data.isItem = true;
            prevSibling.data.IconEl.style.display = "none";
        }
    }

    deleteNode(nodeId: number) {
        const node = this.nodeDict.get(nodeId);
        if (!node) return;
        
        const parentNode = node.parent;
        let childrens = node.childrens;
        let index = parentNode!.childrens.indexOf(node);
        node.data.FolderEl.remove();
        this.tree.removeNode(node);
        //add childrens to previous sibling or if not siblings ot parent as first elems
        if (parentNode) {
            const siblings = parentNode.childrens;
            if (index > 0) {
                const previousSibling = siblings[index - 1];
                childrens.forEach((child) => {
                    this.addHTMLinChild(previousSibling!, child);
                    child.parent = previousSibling!;
                });
                previousSibling!.data.isItem = false;
                previousSibling!.data.IconEl.style.display = "block";
            } else {
                childrens.forEach((child) => {
                    this.addHTMLinChild(parentNode, child);
                    child.parent = parentNode;
                });
            }
        }    
        this.nodeDict.delete(nodeId);

        if (parentNode.childrens.length === 0) {
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
        const prevSibling = siblings[index - 1];

        if (prevSibling) {
            parentHtml.childrens.insertAfter(childHtml.FolderEl, prevSibling.data.FolderEl);
        } else {
            parentHtml.childrens.prepend(childHtml.FolderEl);
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
        if (node.depth> SETTINGS.collapseDepth) {
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

        const openContextMenuAt = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            document.querySelectorAll(".context-menu-root").forEach((menu) => menu.remove());

            createContextMenuUI(e.clientX, e.clientY, {
                onExpand: () => {
                    expandSubtree(headingNode, (heading: HtmlHeading) => this.OnHeadingButtonClicked(heading));
                },
                onCollapse: () => { 
                    collapseSubtree(headingNode, (heading: HtmlHeading) => this.OnHeadingButtonClicked(heading));
                },
                refresh: () => { this.viewModel.refreshTree(); },
            });
        };

        folderSelf.addEventListener("contextmenu", openContextMenuAt);
        folderEl.addEventListener("contextmenu", openContextMenuAt);

        return headingNode;
    }

    OnHeadingButtonClicked(node: HtmlHeading) {
        const childrenEl = node.childrens as HTMLElement;

        if (node.IconEl.classList.contains("is-collapsed")) {
            node.IconEl.classList.remove("is-collapsed");
            node.FolderEl.appendChild(childrenEl);
            animateExpand(childrenEl);
        } else {
            node.IconEl.classList.add("is-collapsed");
            animateCollapse(childrenEl);
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