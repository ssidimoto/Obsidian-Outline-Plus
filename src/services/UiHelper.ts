import { htmlHeading } from "datatypes/Heading"
import { HeadingNode } from "datatypes/HeadingsTree"
import { App, Editor, EditorPosition } from "obsidian"

export const HTMLCls = {
        HeadingContainer: "heading-container",
        heading: "heading",
        SubHeading: "sub-headings",
        HeadingButton: "heading-button",
        HeadingText: "heading-text"
    }

export class UiHelper{

    workspace: App
        
    constructor(workspace: App){
        this.workspace = workspace
    }

    static createRootHtmlHeading(root: HTMLElement){
        let rootHeadingContainer = root.createDiv({cls: HTMLCls.HeadingContainer});
        let rootHeadingHeading = rootHeadingContainer.createDiv({cls: HTMLCls.heading});
        let rootSubHeading = rootHeadingContainer.createDiv({cls: HTMLCls.SubHeading});
        let rootHTMLHeading = new htmlHeading(rootHeadingContainer, rootHeadingHeading, rootSubHeading, true, Array(maxHeadingDepth).fill(0), 0)
        return rootHTMLHeading
    }
    createHTMLHeading(heading_title: string, depth: number, lineNbr: number, editor: Editor): htmlHeading{
        let displayed = depth == 1
        let root = document.createElement('div')
        let headingContainer = root.createEl('div', {cls: HTMLCls.HeadingContainer})
        headingContainer.hidden = false 
        //TODO: manage so that only first rank leaves are displayed, and top leaves are too even if depth smaller than 1
        let heading = headingContainer.createDiv({cls: HTMLCls.heading})
        let subHeading = headingContainer.createDiv({cls: HTMLCls.SubHeading})
        let button = heading.createEl('button', {text: '>', cls: HTMLCls.HeadingButton})
        let text = heading.createEl('div', {text: heading_title, cls: HTMLCls.HeadingText})
        let newHeading = new htmlHeading(headingContainer, heading, subHeading)

        button.addEventListener('click', () => {
            if(newHeading.displayed){
                UiHelper.hideHeading(newHeading)
                newHeading.displayed = false
            }else {
                UiHelper.showHeading(newHeading)
                newHeading.displayed = true
            }
        })
        //warning if user is in read mode it doesnt work. to fix next
        text.addEventListener('click', async () => {
            try {
                const line = editor.getLine(lineNbr);
                const headLine = line.substring(depth).trim();
                const highlightedHeadLine = "==" + headLine + "==";
                
                const startPos: EditorPosition = { line: lineNbr, ch: depth + 1 };
                const endPos: EditorPosition = { line: lineNbr, ch: depth + headLine.length + 1 };
                
                // Highlight the heading
                editor.replaceRange(highlightedHeadLine, startPos, endPos);
                editor.scrollIntoView({ from: startPos, to: startPos }, true);
                
                // Wait 3 seconds
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Restore original heading
                const restoreEndPos: EditorPosition = { line: lineNbr, ch: depth + highlightedHeadLine.length + 1 };
                editor.replaceRange(headLine, startPos, restoreEndPos);
                editor.setCursor(startPos);

                //handle problem when click rapidly on diffrent views

            } catch (error) {
                console.error('Error highlighting heading:', error);
            }
        });



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
//html tree with id. each heading has an id. when build htmlheadingtree use these same id. store all html node in a dictionnary to find them fast