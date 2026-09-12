import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { Component } from "obsidian";
import { Heading, HtmlHeading } from "datatypes/Heading";
import { TreeFileViewModel, TreeAction, ParamUpdateAction } from "views/ViewModel/TreeFileViewModel";
import { Subscription } from "rxjs";
import { expandPathToNode, animateCollapse, animateExpand, collapsePathToNode, expandSubtree, collapseSubtree } from "./Animation";
import { createContextMenuUI, createGearIcon } from "./ParametersUI";
import { renderHeadingTitle } from "./HeadingRenderer";
import { SETTINGS } from "../main";

/** Marks the heading row the reading position is currently inside. */
const ACTIVE_ROW_CLASS = "is-active";

/** UI builder for the headings tree. */
export class TreeFileUi {
    tree!: HeadingsTree<HtmlHeading>;
    nodeDict: Map<number, HeadingNode<HtmlHeading>> = new Map();
    viewModel: TreeFileViewModel;
    container: HTMLElement;
    hooveredNode: HeadingNode<HtmlHeading> | undefined = undefined;
    private changeSubscription?: Subscription;
    /** Loaded component the rendered titles hang off, so they die with the view. */
    private owner: Component;
    /**
     * One component per row, owning whatever rendering that row's title spawned (math,
     * embeds, link popovers). Retired with the row so nothing accumulates across edits.
     */
    private rowScopes: Map<number, Component> = new Map();

    constructor(viewModel: TreeFileViewModel, container: HTMLElement, owner: Component) {
        this.viewModel = viewModel;
        this.container = container;
        this.owner = owner;
        this.init();
    }

    private retireRowScope(nodeId: number) {
        const scope = this.rowScopes.get(nodeId);
        if (!scope) return;
        this.owner.removeChild(scope);
        this.rowScopes.delete(nodeId);
    }

    private retireAllRowScopes() {
        for (const scope of this.rowScopes.values()) this.owner.removeChild(scope);
        this.rowScopes.clear();
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
                    // Tear down first: rebuilding the root row registers a new scope that
                    // the teardown would otherwise retire straight away.
                    this.destroyTree();
                    this.removeError();
                    break;
                case TreeAction.scrolled:
                    if (change.node !== undefined && change.node !== null) this.scrollToLine(change.node as number);
                    break;
                case TreeAction.update:
                    this.updateNode(change.node as HeadingNode<Heading>);
                    break;
                case TreeAction.Error:
                    this.destroyTree();
                    this.error();
                    break;
                default:
                    break;
            }
        });
    }

    createRootNode() {
        const rootHeading = new Heading("File Outline", 0, 0);
        const rootHeadingNode = new HeadingNode(rootHeading, -1, 0);

        const rootHTMLHeadingNode = this.newNode(rootHeadingNode);
        rootHTMLHeadingNode.data.childrens.classList.add("file-outline-root-children");
        this.container.appendChild(rootHTMLHeadingNode.data.FolderEl);
        rootHTMLHeadingNode.data.IconEl.parentElement?.append(createGearIcon((action: ParamUpdateAction, val: number) => this.viewModel.onChange(action, val)));
        rootHTMLHeadingNode.data.IconEl.parentElement?.classList.add("file-outline-root-self");
        rootHTMLHeadingNode.data.TitleEl.classList.add("file-outline-root-title");
        this.tree = new HeadingsTree<HtmlHeading>(rootHTMLHeadingNode);
        this.nodeDict.set(rootHTMLHeadingNode.id, rootHTMLHeadingNode);
    }

    error(){
        this.container.empty();
        const wrapper = createDiv({ cls: "file-outline-error" });
        const errorEl = createDiv();
        //append child with text error : 
        const error = createDiv();
        error.textContent = "Error :"
        wrapper.appendChild(error);
        errorEl.textContent = "No compatible file found."
        wrapper.appendChild(errorEl);
        wrapper.appendChild(createEl("br"));
        const errorEl2 = createDiv();
        errorEl2.textContent = "Please open a Markdown file to use the file outline view."
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
            this.hooveredNode.data.IconEl.parentElement?.classList.remove(ACTIVE_ROW_CLASS);
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
        closestNode.data.IconEl.parentElement?.classList.add(ACTIVE_ROW_CLASS);

        this.hooveredNode = closestNode;
    }


    updateNode(node: HeadingNode<Heading>) {
        const uiNode = this.nodeDict.get(node.id);
        if (uiNode) {
            uiNode.data.lineNbr = node.data.lineNbr;
            uiNode.data.width = node.data.width ?? 0;
        }
    }

    addNode(node: HeadingNode<HtmlHeading>) {
        this.tree.addNode(node);
        this.nodeDict.set(node.id, node);

        if (node.parent) {
            this.addHTMLinChild(node.parent, node);
            node.parent.data.isItem = false;
            node.parent.data.IconEl.setCssStyles({ display: "block" });
        }

        //add all its child and remove them from current node parent
        if(node.childrens.length > 0) {
            node.childrens.forEach((child) => {
                this.addHTMLinChild(node, child);
            });
            node.data.isItem = false;
            node.data.IconEl.setCssStyles({ display: "block" });
        }

        //if prev sibling no more child remove its icon
        let prevSibling = node.parent?.childrens[node.parent.childrens.indexOf(node) - 1];
        if (prevSibling && prevSibling.childrens.length === 0) {
            prevSibling.data.isItem = true;
            prevSibling.data.IconEl.setCssStyles({ display: "none" });
        }
    }

    deleteNode(nodeId: number) {
        const node = this.nodeDict.get(nodeId);
        if (!node) return;
        
        const parentNode = node.parent;
        let childrens = node.childrens;
        let index = parentNode.childrens.indexOf(node);
        node.data.FolderEl.remove();
        this.retireRowScope(nodeId);
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
                previousSibling!.data.IconEl.setCssStyles({ display: "block" });
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
            parentNode.data.IconEl.setCssStyles({ display: "none" });
        }
    }

    destroyTree() {
        this.tree.root.childrens = [];
        this.clearTreeHtml(this.tree.root.data);
        this.nodeDict.clear();
        this.nodeDict.set(this.tree.root.id, this.tree.root);
        this.retireAllRowScopes();
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
        const folderEl = createDiv();
        folderEl.className = "tree-item nav-folder";

        const folderSelf = createDiv();
        folderSelf.className = "tree-item-self nav-folder-title is-clickable mod-collapsible file-outline-item-self";
        folderSelf.setAttribute("draggable", "true");

        const iconContainer = createDiv();
        iconContainer.className = "tree-item-icon collapse-icon";
        if (node.childrens.length === 0) {
            iconContainer.setCssStyles({ display: "none" });
        }

        const svg = createSvg("svg", {
            attr: {
                xmlns: "http://www.w3.org/2000/svg",
                width: "24",
                height: "24",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                class: "svg-icon right-triangle",
            },
        });

        const path = createSvg("path", { attr: { d: "M3 8L12 17L21 8" } });
        svg.appendChild(path);
        iconContainer.appendChild(svg);

        const titleEl = createDiv();
        titleEl.className = "tree-item-inner nav-folder-title-content file-outline-title";
        titleEl.setAttribute("data-initialized", "true");
        const titleScope = renderHeadingTitle(
            titleEl,
            node.data.headLine,
            this.viewModel.plugin.app,
            this.viewModel.sourcePath,
            this.owner
        );
        if (titleScope) this.rowScopes.set(node.id, titleScope);

        const children = createDiv();
        children.className = "tree-item-children nav-folder-children";

        const spacer = createDiv({ cls: "file-outline-spacer" });
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
            node.data.width ?? 0
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
            void this.viewModel.OnHeadingClicked(headingNode.id);
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
        const childrenEl = node.childrens;

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
        this.retireAllRowScopes();
    }
}
