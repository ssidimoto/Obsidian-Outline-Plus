import { Itemhierarchy } from "datatypes/ItemHierarchy"
import { write } from "fs";
import { off } from "process";
import { first } from "rxjs";
import { writeLog } from "utils/uilts";

export class HeadingNode<T extends Itemhierarchy> {
    childrens: HeadingNode<T>[] = []
    parent: HeadingNode<T>;
    data: T;
    depth: number;
    id: number

    constructor(data: T, depth: number, id: number){
        this.data = data
        this.depth = depth
        this.id = id
    }

    equals (other: HeadingNode<T>): boolean {
        return this.data.equals(other.data) && this.depth === other.depth
    }

    //copy object with changes given in argumennt
    copy(changes: Partial<HeadingNode<T>>, dataChanges?: Partial<T>): HeadingNode<T> {

        const newData = dataChanges
            ? this.data.copy(dataChanges)
            : this.data

        return new HeadingNode<T>(
            changes.data ?? newData,
            changes.depth ?? this.depth,
            changes.id ?? this.id
        )
    }
    addNode(node: HeadingNode<T>, depth: number){
        if (node.depth === depth) {
            this.insertSibling(node);
        }

        else if (node.depth > depth) {
            if (this.childrens.length === 0) {
                this.attachChild(node);

            }

            else if (!this.tryInsertAmongChildren(node)){
                this.insertAfterLast(node);
            }
        }
    }

    private insertSibling(node: HeadingNode<T>) {
        for (let i = 0; i < this.childrens.length; i++) {
            const child = this.childrens[i]!;
            if (node.depth === child.depth && node.data.lineNbr < child.data.lineNbr) {
                this.childrens.splice(i, 0, node);
                node.parent = this;

                const prev = this.childrens[i - 1]!;
                if(prev) {
                    node.stealSiblingNodes(prev)
                }
                return;
            }
        }
        const prev = this.childrens.at(-1)
        this.childrens.push(node);
        node.parent = this;
        if(prev) {
            node.stealSiblingNodes(prev)
        }
    }

    private attachChild(node: HeadingNode<T>) {
        this.childrens.push(node);
        node.parent = this;
    }

    private stealSiblingNodes(prev: HeadingNode<T>) {
        let nodeToAdd: HeadingNode<T>[] = []
        let apply = (prevChild: HeadingNode<T>) => {
            if(this.data.lineNbr < prevChild.data.lineNbr){
                nodeToAdd.push(prevChild)
                return
            }
        }
        prev.inorderTraversal(apply, {begin: prev.data.lineNbr, end: Number.POSITIVE_INFINITY})
        nodeToAdd.reverse().forEach((prevChild) => {
            console.log("node to add: " + prevChild.toString())
            prevChild.childrens = []
            prevChild.parent.childrens = this.parent.childrens.filter((child) => !child.equals(prevChild))
            this.addNode(prevChild, this.depth + 1)
        })
    }

    private tryInsertAmongChildren(node: HeadingNode<T>): boolean {
        for (let i = 0; i < this.childrens.length; i++) {
                const child = this.childrens[i]!;
            if (node.depth > child.depth && node.data.lineNbr < child.data.lineNbr) {
                const prev = this.childrens[i - 1];
                if (prev) {
                    prev.addNode(node, child.depth + 1);
                } else {
                    this.childrens.splice(0, 0, node);
                    node.parent = this;
                }
                return true;
            }
            if (node.depth < child.depth && node.data.lineNbr < child.data.lineNbr) {
                this.childrens.splice(i + 1, 0, node);
                node.parent = this;
                return true;
            }
        }
        return false;
    }

    private insertAfterLast(node: HeadingNode<T>) {
        const last = this.childrens.at(-1)!;
        if (node.depth > last.depth && node.data.lineNbr > last.data.lineNbr) {
            last.addNode(node, last.depth + 1);
        } else {
            this.childrens.push(node);
            node.parent = this;
        }
    }

    remove(){
        this.parent.childrens = this.parent.childrens.filter((child) => !child.equals(this))

        this.childrens.forEach((child) => {
            child.parent = this.parent
            this.parent.tryInsertAmongChildren(child)
            console.log(child.toString())
        })
        this.childrens = [];
    }

    inorderTraversal(apply: (node: HeadingNode<T>) => void, range: {begin: number, end: number}){
        if(this.data.lineNbr > range.end) return
        if(this.data.lineNbr >= range.begin) apply(this)
        this.childrens.forEach((child)=>{
            child.inorderTraversal(apply, range)
        })
    }

    findClosestNode(lineNbr: number): HeadingNode<T> {
        for (let i = 1; i < this.childrens.length; i++) {
            const child = this.childrens[i]!;
            if (lineNbr < child.data.lineNbr) {
                return this.childrens[i-1]!.findClosestNode(lineNbr)
            }else if(lineNbr === child.data.lineNbr) {
                return child
            }
        }
        if(this.childrens.length > 0){
            return this.childrens.at(-1)!.findClosestNode(lineNbr)
        }else return this
    }

    toString(): string {
        //print heading node depth and id then print its data
        return `node : [depth: ${this.depth}, id: ${this.id}] ||-> ${this.data.toString()}`
    }
}

export class HeadingsTree<T extends Itemhierarchy> {
    root: HeadingNode<T>;
    constructor(root: HeadingNode<T>){
        this.root = root
    }
    addNode(node: HeadingNode<T>){
        this.root.addNode(node, 1,)
    }

    findClosestNode(lineNbr: number): HeadingNode<T> | undefined{
        for (let i = 0; i < this.root.childrens.length; i++) {
            const child = this.root.childrens[i]!;
            if (lineNbr < child.data.lineNbr) {
                let node = this.root.childrens[i-1]!.findClosestNode(lineNbr)
                if(node) return node
                else return child
            }
            else if(lineNbr === child.data.lineNbr) {
                return child
            }
        }
        if(this.root.childrens.length > 0){
            return this.root.childrens.at(-1)!.findClosestNode(lineNbr)
        }else return undefined
    }

    inorderTraversal(apply: (node: HeadingNode<T>) => void, range: {begin: number, end: number}) {
        this.root.inorderTraversal(apply, range)
    }

    shiftLines(offset: number, begin: number){
        let apply = (node: HeadingNode<T>) => {
            node.data.lineNbr += offset
        }

        let range = {begin: begin, end: Number.POSITIVE_INFINITY}
        this.root.inorderTraversal(apply, range)
    }
    
    removeNode(node: HeadingNode<T>){
        node.remove()
    }

    toString(): string {
        let result = "";
        //use inoder traversal and apply add tab for depth
        const apply = (node: HeadingNode<T>) => {
            result += `${"   ".repeat(node.depth)}- ${node.toString()}\n`
        }
        this.inorderTraversal(apply, {begin: 0, end: Number.POSITIVE_INFINITY})
        return result
    }
}