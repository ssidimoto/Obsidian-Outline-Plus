import { htmlHeading } from "datatypes/Heading"
import { HeadingNode } from "datatypes/HeadingsTree"

export const HTMLCls = {
        HeadingContainer: "heading-container",
        heading: "heading",
        SubHeading: "sub-heading",
        HeadingButton: "heading-button",
        HeadingText: "heading-text"
    }

export class UiHelper{
    static createRootHtmlHeading(root: HTMLElement){
        let rootHeadingContainer = root.createDiv({cls: HTMLCls.HeadingContainer});
        let rootHeadingHeading = rootHeadingContainer.createDiv({cls: HTMLCls.heading});
        let rootSubHeading = rootHeadingContainer.createDiv({cls: HTMLCls.SubHeading});
        let rootHTMLHeading = new htmlHeading(rootHeadingContainer, rootHeadingHeading, rootSubHeading)
        return rootHTMLHeading
    }
    static createHTMLHeading(heading_title: string): htmlHeading{
        let heading_container = document.createEl('div', {cls: HTMLCls.HeadingContainer})
        let heading = heading_container.createDiv({cls: HTMLCls.heading})
        let subHeading = heading_container.createDiv({cls: HTMLCls.heading})
        heading.createEl('button', {text: '>', cls: HTMLCls.HeadingButton})
        heading.createEl('div', {text: heading_title, cls: HTMLCls.HeadingText})
        return new htmlHeading(heading_container, heading, subHeading)
    } 

    static addHTMLinChild(parent:htmlHeading, child: htmlHeading){
        parent.subHeading.insertAdjacentElement("beforeend", child.headingContainer)
    }

    static removeHTMLinChild(parent:htmlHeading, child: htmlHeading, cls: string){
        parent.headingContainer.querySelector('.' + cls)?.remove()

    }
    static clearNodeHTML(node: htmlHeading) {
        node.heading.remove()
        node.subHeading.remove()
        node.headingContainer.remove()
    }

    static hideHeading(node: HeadingNode){
        node.childrens.forEach((child) => {
            child.data.uiElem.headingContainer.hidden = true;
            }
        );    
    }
    static showHeading(node: HeadingNode){
        node.childrens.forEach((child) => {
            child.data.uiElem.headingContainer.hidden = true;
            }
        );  
    }
}