import { Itemhierarchy } from "datatypes/ItemHierarchy"

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
    addNode(node: HeadingNode<T>, depth: number) {
        if (node.depth === depth) {
            this.insertSibling(node);
            return;
        }

        if (node.depth > depth) {
            if (this.childrens.length === 0) {
                this.attachChild(node);
            return;
            }
            if (this.tryInsertAmongChildren(node)) return;
                this.insertAfterLast(node);
            }
        }

        private insertSibling(node: HeadingNode<T>) {
            for (let i = 0; i < this.childrens.length; i++) {
                const child = this.childrens[i]!;
                if (node.depth === child.depth && node.data.lineNbr < child.data.lineNbr) {
                    this.childrens.splice(i, 0, node);
                    node.parent = this;
                    return;
                }
            }
            this.childrens.push(node);
            node.parent = this;
    }

    private attachChild(node: HeadingNode<T>) {
        this.childrens.push(node);
        node.parent = this;
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

    shiftLines(offset: number){
        return
    }

    remove(){
        this.childrens.forEach((child) => {
            child.parent = this.parent
        })
        this.childrens = [];
    }

    inorderTraversal(apply: (node: HeadingNode<T>) => void) {
        apply(this)
        this.childrens.forEach((child)=>{
            child.inorderTraversal(apply)
        })
    }
}

export class HeadingsTree<T extends Itemhierarchy> {
    root: HeadingNode<T>;
    constructor(root: HeadingNode<T>){
        this.root = root
    }
    addNode(node: HeadingNode<T>){
        this.root.addNode(node, 1)
    }

    inorderTraversal(apply: (node: HeadingNode<T>) => void) {
        this.root.inorderTraversal(apply)
    }

    // findNode(node: {depth: number; index: number[]}, curr_depth: number){
    //     this.root.findNode(node, 0)
    // }

    removeNode(node: HeadingNode<T>){
        node.remove()
    }
    
}