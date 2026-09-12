import { HtmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import {SETTINGS} from "../main";

export function animateCollapse(childrenEl: HTMLElement) {
        const startHeight = childrenEl.scrollHeight;
        childrenEl.setCssStyles({
            overflow: "hidden",
            height: `${startHeight}px`,
            transition: "height 150ms ease",
        });
        
        void childrenEl.offsetHeight; // Force reflow
        childrenEl.setCssStyles({ height: "0px" });

        const onEnd = (event: TransitionEvent) => {
            if (event.target !== childrenEl) return;
            childrenEl.removeEventListener("transitionend", onEnd);
            childrenEl.remove();
            childrenEl.setCssStyles({
                height: "",
                overflow: "",
                transition: "",
            });
        };
        childrenEl.addEventListener("transitionend", onEnd);
        
}

export function expandAllChildren(node: HeadingNode<HtmlHeading>, OnHeadingButtonClicked: (heading: HtmlHeading) => void = () => {}) {
    const childrens = node.childrens;
    childrens.forEach((child) => {
        expandAllChildren(child, OnHeadingButtonClicked);

        if (child.data.IconEl.classList.contains("is-collapsed")) {
            OnHeadingButtonClicked(child.data);
        }
    });
}

/**
 * Expands the full subtree rooted at `node` in a deterministic order.
 * Parent is always opened before children so UI state and animations stay consistent.
 */
export function expandSubtree(node: HeadingNode<HtmlHeading>, OnHeadingButtonClicked: (heading: HtmlHeading) => void) {
    if (node.childrens.length === 0) return;

    if (node.data.IconEl.classList.contains("is-collapsed")) {
        OnHeadingButtonClicked(node.data);
    }

    for (const child of node.childrens) {
        expandSubtree(child, OnHeadingButtonClicked);
    }
}

/**
 * Collapses the full subtree rooted at `node` in post-order.
 * Children close first, then parent, to avoid transient UI inconsistencies.
 */
export function collapseSubtree(node: HeadingNode<HtmlHeading>, OnHeadingButtonClicked: (heading: HtmlHeading) => void) {
    if (node.childrens.length === 0) return;

    for (const child of node.childrens) {
        collapseSubtree(child, OnHeadingButtonClicked);
    }

    if (!node.data.IconEl.classList.contains("is-collapsed")) {
        OnHeadingButtonClicked(node.data);
    }
}


export function animateExpand(childrenEl: HTMLElement) {
    const targetHeight = childrenEl.scrollHeight;
    childrenEl.setCssStyles({
        overflow: "hidden",
        height: "0px",
        transition: "height 150ms ease",
    });
    
    void childrenEl.offsetHeight; // Force reflow
    childrenEl.setCssStyles({ height: `${targetHeight}px` });

    const onEnd = (event: TransitionEvent) => {
        if (event.target !== childrenEl) return;
        childrenEl.removeEventListener("transitionend", onEnd);
        childrenEl.setCssStyles({
            height: "",
            overflow: "",
            transition: "",
        });
    };
    childrenEl.addEventListener("transitionend", onEnd);
}

/** 
 * Remplacement de recursiveExpand :
 * Ouvre les PARENTS du nœud ciblé pour qu'il devienne visible.
 */
export function expandPathToNode(node: HeadingNode<HtmlHeading>, tree: HeadingsTree<HtmlHeading>, OnHeadingButtonClicked: (heading: HtmlHeading) => void) {
    let current: HeadingNode<HtmlHeading> | undefined = node.parent;
    const nodesToExpand: HeadingNode<HtmlHeading>[] = [];
    // Récupérer tous les parents actuellement fermés
    while (current) {
        if (current.data.IconEl.classList.contains("is-collapsed")) {
            nodesToExpand.push(current);
        }
        current = current.parent;
    }

    // Les ouvrir de haut en bas (du plus grand parent au plus petit)
    // C'est indispensable pour que le scrollHeight se calcule correctement dans animateExpand !
    for (let i = nodesToExpand.length - 1; i >= 0; i--) {
        OnHeadingButtonClicked(nodesToExpand[i]!.data);
    }
}

//collapse node recursively from root to leaf with recursive function
export function collapsePathToNode(node: HeadingNode<HtmlHeading>, OnHeadingButtonClicked: (heading: HtmlHeading) => void, initdepth: number = 0) {
    
    for (const child of node.childrens) {
        collapsePathToNode(child, OnHeadingButtonClicked, initdepth);
        if (!child.parent.data.IconEl.classList.contains("is-collapsed")) {
            if(child.depth > SETTINGS.collapseDepth && (Math.abs(child.depth - initdepth) > SETTINGS.dynamicCollapseDepthDiff || SETTINGS.dynamicCollapseDepthDiff === 0)
            && !child.parent.data.IconEl.classList.contains("is-collapsed")) { // don't collapse root node
                OnHeadingButtonClicked(child.parent.data);
            }
        }
    } 
}
