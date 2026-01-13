import { UiHelper } from "services/UiHelper";
import { Heading, htmlHeading } from "./Heading";
import { HTMLCls } from "services/UiHelper";

export class HeadingNode {
    childrens: HeadingNode[] = []
    parent: HeadingNode;
    data: Heading;
    depth: number;

    constructor(data: Heading, depth: number){
        this.data = data
        this.depth = depth
    }

    addNode(node: HeadingNode, curr_depth: number){

        if(node.depth == curr_depth){

            this.childrens.forEach((child) => {
                if(child.depth == node.depth && 
                    child.data.index[curr_depth] == node.data.index[curr_depth]){

                    throw Error("this node already exists")
                }
                else if(child.depth > node.depth && 
                    child.data.index[curr_depth] == node.data.index[curr_depth]){
                    node.childrens.push(child)
                    child.parent = node
                    //handle html here when create new intermediary, must delete this. html child, and add them instead to node.html childs
                }
            });
            node.parent = this;
            this.childrens.push(node)
            UiHelper.addHTMLinChild(this.data.uiElem, node.data.uiElem)
        }
        if(node.depth > this.depth){
            let nodeAdded = false
             this.childrens.forEach((child) => {
                if(child.data.index[curr_depth] == node.data.index[curr_depth]){
                    child.addNode(node, curr_depth + 1)
                    nodeAdded = true
                }
            });

            if(nodeAdded == false){
                node.parent = this
                this.childrens.push(node)
                UiHelper.addHTMLinChild(this.data.uiElem, node.data.uiElem)
            }
        }
        return
    }

    remove(){
        this.childrens.forEach((child) => {
            child.parent = this.parent
        })
        this.childrens = [];
        UiHelper.clearNodeHTML(this.data.uiElem)
    }

    findNode(node: {depth: number; index: number[]}, curr_depth: number): HeadingNode | null{

        if(node.depth == curr_depth){
            let foundChild = null;
            this.childrens.forEach((child) => {
                if(child.depth == node.depth && 
                    child.data.index[curr_depth] == node.index[curr_depth]){
                    foundChild = child
                }
            });
            return foundChild
        }
        if(node.depth > this.depth){
            let foundNode: HeadingNode | null = null;
             this.childrens.forEach((child) => {
                if(child.data.index[curr_depth] == node.index[curr_depth]){
                    foundNode = child.findNode(node, curr_depth + 1)
                }
            });
            return foundNode
        }
        return null
    } 
}

export class HeadingsTree {
    root: HeadingNode;

    constructor(root: HeadingNode){
        this.root = root
    }
    addNode(node: HeadingNode){
        this.root.addNode(node, 0)
    }

    findNode(node: {depth: number; index: number[]}, curr_depth: number){
        return this.root.findNode(node, 0)
    }

    removeNode(node: {depth: number; index: number[]}, curr_depth: number){
        let nodeToRemove = this.root.findNode(node, 0)
        if(nodeToRemove != null){
            nodeToRemove.remove()
        }
    }
}