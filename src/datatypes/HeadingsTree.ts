import { Itemhierarchy } from "datatypes/Heading"

export class HeadingNode<T extends Itemhierarchy> {
    childrens: HeadingNode<T>[] = []
    parent: HeadingNode<T>;
    data: T;
    depth: number;

    constructor(data: T, depth: number){
        this.data = data
        this.depth = depth
    }

    addNode(node: HeadingNode<T>, curr_depth: number){

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

                }
            });
            node.parent = this
            this.childrens.push(node)
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
                this.childrens.push(node)
            }
        }
        return
    }

    remove(){
        this.childrens.forEach((child) => {
            child.parent = this.parent
        })
        this.childrens = [];
    }

    findNode(node: {depth: number; index: number[]}, curr_depth: number): HeadingNode<T> | null{

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
             this.childrens.forEach((child) => {
                if(child.data.index[curr_depth] == node.index[curr_depth]){
                    child.findNode(node, curr_depth + 1)
                }
            });
        }
        return null
    }
}

export class HeadingsTree<T extends Itemhierarchy> {
    root: HeadingNode<T>;

    constructor(root: HeadingNode<T>){
        this.root = root
    }
    addNode(node: HeadingNode<T>){
        this.root.addNode(node, 0)
    }

    findNode(node: {depth: number; index: number[]}, curr_depth: number){
        this.root.findNode(node, 0)
    }

    removeNode(node: {depth: number; index: number[]}, curr_depth: number){
        let nodeToRemove = this.root.findNode(node, 0)
        if(nodeToRemove != null){
            nodeToRemove.remove()
        }
    }

    
}