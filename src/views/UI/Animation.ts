import { HtmlHeading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { finishRenderMath, renderMath } from "obsidian";
import { ParametersData } from "../ViewModel/ParametersViewModel";

export function animateCollapse(childrenEl: HTMLElement) {
    childrenEl.style.overflow = "hidden";
    childrenEl.style.height = `${childrenEl.scrollHeight}px`;
    void childrenEl.offsetHeight; // Force reflow
    childrenEl.style.transition = "height 150ms ease";
    childrenEl.style.height = "0px";

    const onEnd = (e: TransitionEvent) => {
        if (e.target !== childrenEl) return;
        childrenEl.removeEventListener("transitionend", onEnd);
        if (childrenEl.style.height === "0px") childrenEl.remove();
        childrenEl.style.cssText = "";
    };
    childrenEl.addEventListener("transitionend", onEnd);
}

export function animateExpand(childrenEl: HTMLElement) {
    childrenEl.style.overflow = "hidden";
    childrenEl.style.height = "auto";
    const targetHeight = childrenEl.scrollHeight;
    childrenEl.style.height = "0px";
    childrenEl.style.transition = "height 150ms ease";
    void childrenEl.offsetHeight; // Force reflow
    childrenEl.style.height = `${targetHeight}px`;

    const onEnd = (e: TransitionEvent) => {
        if (e.target !== childrenEl) return;
        childrenEl.removeEventListener("transitionend", onEnd);
        childrenEl.style.cssText = "";
    };
    childrenEl.addEventListener("transitionend", onEnd);
}

export function expandSubtree(node: HeadingNode<HtmlHeading>, OnHeadingButtonClicked: (heading: HtmlHeading) => void) {
    if (node.childrens.length === 0) return;
    if (node.data.IconEl.classList.contains("is-collapsed")) {
        OnHeadingButtonClicked(node.data);
    }
    for (const child of node.childrens) {
        expandSubtree(child, OnHeadingButtonClicked);
    }
}

export function collapseSubtree(node: HeadingNode<HtmlHeading>, OnHeadingButtonClicked: (heading: HtmlHeading) => void) {
    if (node.childrens.length === 0) return;
    for (const child of node.childrens) {
        collapseSubtree(child, OnHeadingButtonClicked);
    }
    if (!node.data.IconEl.classList.contains("is-collapsed")) {
        OnHeadingButtonClicked(node.data);
    }
}

export function expandPathToNode(node: HeadingNode<HtmlHeading>, tree: HeadingsTree<HtmlHeading>, OnHeadingButtonClicked: (heading: HtmlHeading) => void) {
    let current: HeadingNode<HtmlHeading> | undefined = node.parent;
    const nodesToExpand: HeadingNode<HtmlHeading>[] = [];

    while (current && current.id !== tree.root.id) {
        if (current.data.IconEl.classList.contains("is-collapsed")) {
            nodesToExpand.push(current);
        }
        current = current.parent;
    }

    for (let i = nodesToExpand.length - 1; i >= 0; i--) {
        OnHeadingButtonClicked(nodesToExpand[i]!.data);
    }
}

export function collapsePathToNode(
    node: HeadingNode<HtmlHeading>,
    OnHeadingButtonClicked: (heading: HtmlHeading) => void,
    params: ParametersData,
    initdepth: number = 0
) {
    for (const child of node.childrens) {
        collapsePathToNode(child, OnHeadingButtonClicked, params, initdepth);
    }
    if (!node.data.IconEl.classList.contains("is-collapsed")) {
        if (node.depth > params.collapseDepth && Math.abs(node.depth - initdepth) > params.dynamicCollapseDepthDiff) {
            OnHeadingButtonClicked(node.data);
        }
    }
}

export function renderHeadingTitle(containerEl: HTMLElement, titleText: string): void {
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