import { Heading } from "datatypes/Heading";
import { HeadingNode, HeadingsTree } from "datatypes/HeadingsTree";
import { App } from "obsidian";
import { BehaviorSubject } from 'rxjs'

const maxHeadingDepth = 6

type TreeLatestChange = {
  id: string
  action: string
  update: string
}

class TreeFileViewModel{
    app: App;
    tree: HeadingsTree<Heading>
    private change = new BehaviorSubject<TreeLatestChange>({
        id: "",
        action: "none",
        update: "none"

    })
    readonly change$ = this.change.asObservable()

    constructor(app: App){
        this.app = app
        
    }

    init(){
        const rootHeading = new Heading("Tree File Structure", Array(maxHeadingDepth).fill(0), 0);
        const root = new HeadingNode(rootHeading, -1);
        this.tree = new HeadingsTree(root);

        this.app.workspace.on('editor-change', editor => {
            let content = editor.getDoc().getValue()
            this.buildHeadingTree(content)
        })

        this.app.workspace.on('active-leaf-change', (leaf) => {
            let content = leaf?.getDisplayText()
            if(content){
                this.buildHeadingTree(content)
            }
        })
    }
    buildHeadingTree(doc: string): void {

        const multiLevelCount = Array(maxHeadingDepth).fill(0);
        const lines = doc.split('\n');
        let currDepth = 0;

        lines.forEach((line, lineNbr) => {
            const hashMatch = line.match(/^#{1,6} /);
            if (hashMatch){

                const depth = hashMatch[0].trim().length;
                const headLine = line.substring(depth).trim();
                const arrLevel = depth - 1;

                // Update level counters
                if (currDepth === arrLevel) {
                    multiLevelCount[currDepth] += 1;
                } else if (currDepth < arrLevel) {
                    multiLevelCount[arrLevel] = 1;
                    currDepth = arrLevel;
                } else if (currDepth > arrLevel) {
                    multiLevelCount.fill(0, arrLevel + 1, maxHeadingDepth - 1);
                    multiLevelCount[arrLevel] += 1;
                    currDepth = arrLevel;
                }

                const heading = new Heading(headLine, multiLevelCount.slice(), lineNbr);
                const node = new HeadingNode(heading, currDepth);
                this.tree.addNode(node)
            }
        });
    }
}