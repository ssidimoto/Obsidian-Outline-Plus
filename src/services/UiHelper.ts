import { htmlHeading } from "datatypes/Heading"
import { HeadingNode } from "datatypes/HeadingsTree"

export const HTMLCls = {
        HeadingContainer: "heading-container",
        heading: "heading",
        SubHeading: "sub-headings",
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
    static createHTMLHeading(heading_title: string, depth: number): htmlHeading{
        console.log(depth + heading_title)
        let displayed = depth == 1
        let root = document.createElement('div')
        let headingContainer = root.createEl('div', {cls: HTMLCls.HeadingContainer})
        headingContainer.hidden = false 
        //TODO: manage so that only first rank leaves are displayed, and top leaves are too even if depth smaller than 1
        let heading = headingContainer.createDiv({cls: HTMLCls.heading})
        let subHeading = headingContainer.createDiv({cls: HTMLCls.SubHeading})
        let button = heading.createEl('button', {text: '>', cls: HTMLCls.HeadingButton})
        heading.createEl('div', {text: heading_title, cls: HTMLCls.HeadingText})

        let newHeading = new htmlHeading(headingContainer, heading, subHeading)

        button.addEventListener('click', () => {
            if(newHeading.displayed){
                this.hideHeading(newHeading)
                console.log("click a !")
                newHeading.displayed = false
            }else {
                this.showHeading(newHeading)
                console.log("click b !")
                newHeading.displayed = true
            }
        })
        return newHeading
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

    static hideHeading(node: htmlHeading){
        node.subHeading.childNodes.forEach((child) => {
            if (child instanceof HTMLElement) {
                child.hidden = true;
            }
        });    
    }
    static showHeading(node: htmlHeading){
        node.subHeading.childNodes.forEach((child) => {
            if (child instanceof HTMLElement) {
                child.hidden = false;
            }
        });  
    }
}