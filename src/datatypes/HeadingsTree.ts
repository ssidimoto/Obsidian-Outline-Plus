import { Itemhierarchy } from "datatypes/ItemHierarchy";

export class HeadingNode<T extends Itemhierarchy> {
    childrens: HeadingNode<T>[] = [];
    parent!: HeadingNode<T>;
    data: T;
    depth: number;
    id: number;

    constructor(data: T, depth: number, id: number) {
        this.data = data;
        this.depth = depth;
        this.id = id;
    }

    equals(other: HeadingNode<T>): boolean {
        return this.data.equals(other.data) && this.depth === other.depth;
    }

    // copy object with changes given in argument
    copy(changes: Partial<HeadingNode<T>>, dataChanges?: Partial<T>): HeadingNode<T> {
        const newData = dataChanges
            ? this.data.copy(dataChanges)
            : this.data;

        return new HeadingNode<T>(
            changes.data ?? newData,
            changes.depth ?? this.depth,
            changes.id ?? this.id
        );
    }

    addNode(node: HeadingNode<T>, depth: number) {
        if (node.depth === depth) {
            this.insertSibling(node);
        } else if (node.depth > depth) {
            if (this.childrens.length === 0) {
                this.attachChild(node);
            } else if (!this.tryInsertAmongChildren(node)) {
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

                const prev = i > 0 ? this.childrens[i - 1] : undefined;
                if (prev) {
                    node.stealSiblingNodes(prev);
                }
                return;
            }
        }
        const prev = this.childrens.at(-1);
        this.childrens.push(node);
        node.parent = this;
        if (prev) {
            node.stealSiblingNodes(prev);
        }
    }

    private attachChild(node: HeadingNode<T>) {
        this.childrens.push(node);
        node.parent = this;
    }

    private stealSiblingNodes(prev: HeadingNode<T>) {
        // Safely extract and reattach subtrees that cross the lineNbr threshold
        const moveAfter = (sourceNode: HeadingNode<T>, thresholdLine: number): HeadingNode<T>[] => {
            const moved: HeadingNode<T>[] = [];
            for (let i = sourceNode.childrens.length - 1; i >= 0; i--) {
                const child = sourceNode.childrens[i]!;
                if (child.data.lineNbr > thresholdLine) {
                    sourceNode.childrens.splice(i, 1);
                    moved.unshift(child); // Keep ordered correctly
                } else {
                    const deeplyMoved = moveAfter(child, thresholdLine);
                    moved.unshift(...deeplyMoved);
                }
            }
            return moved;
        };

        const nodesToMove = moveAfter(prev, this.data.lineNbr);
        nodesToMove.forEach(node => {
            this.addNode(node, this.depth + 1);
        });
    }

    private tryInsertAmongChildren(node: HeadingNode<T>): boolean {
        for (let i = 0; i < this.childrens.length; i++) {
            const child = this.childrens[i]!;
            
            if (node.depth > child.depth && node.data.lineNbr < child.data.lineNbr) {
                const prev = i > 0 ? this.childrens[i - 1] : undefined;
                if (prev) {
                    prev.addNode(node, child.depth + 1);
                } else {
                    this.childrens.splice(0, 0, node);
                    node.parent = this;
                }
                return true;
            }
            
            if (node.depth < child.depth && node.data.lineNbr < child.data.lineNbr) {
                this.childrens.splice(i, 0, node); // FIX: splice at i, not i + 1
                node.parent = this;
                
                // Adopt subsequent children that are now physically after this new node
                while (i + 1 < this.childrens.length) {
                    const nextChild = this.childrens[i + 1]!;
                    if (nextChild.data.lineNbr > node.data.lineNbr) {
                        this.childrens.splice(i + 1, 1);
                        node.addNode(nextChild, node.depth + 1);
                    } else {
                        break;
                    }
                }
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

    remove() {
        if (!this.parent) return; // safeguard
        this.parent.childrens = this.parent.childrens.filter((child) => !child.equals(this));

        const orphans = [...this.childrens];
        this.childrens = [];
        
        orphans.forEach((child) => {
            this.parent.addNode(child, this.parent.depth + 1); // safely routes it to the proper spot
            console.log(child.toString());
        });
    }

    inorderTraversal(apply: (node: HeadingNode<T>) => void, range: { begin: number, end: number }) {
        if (this.data.lineNbr > range.end) return;
        if (this.data.lineNbr >= range.begin) apply(this);
        this.childrens.forEach((child) => {
            child.inorderTraversal(apply, range);
        });
    }

    findClosestNode(lineNbr: number): HeadingNode<T> {
        if (this.childrens.length === 0) return this;
        if (lineNbr < this.childrens[0]!.data.lineNbr) return this;

        for (let i = 0; i < this.childrens.length; i++) {
            const child = this.childrens[i]!;
            if (lineNbr === child.data.lineNbr) {
                return child;
            }
            if (i < this.childrens.length - 1) {
                const nextChild = this.childrens[i + 1]!;
                if (lineNbr < nextChild.data.lineNbr) {
                    return child.findClosestNode(lineNbr);
                }
            }
        }
        return this.childrens.at(-1)!.findClosestNode(lineNbr);
    }

    toString(): string {
        return `node : [depth: ${this.depth}, id: ${this.id}] ||-> ${this.data.toString()}`;
    }
}

export class HeadingsTree<T extends Itemhierarchy> {
    root: HeadingNode<T>;
    
    constructor(root: HeadingNode<T>) {
        this.root = root;
    }
    
    addNode(node: HeadingNode<T>) {
        this.root.addNode(node, 1);
    }

    findClosestNode(lineNbr: number): HeadingNode<T> | undefined {
        if (this.root.childrens.length === 0) return undefined;
        if (lineNbr < this.root.childrens[0]!.data.lineNbr) return this.root.childrens[0];
        
        const closest = this.root.findClosestNode(lineNbr);
        // Ensure that a node physically before the first item safely yields the first child
        return closest === this.root ? this.root.childrens[0] : closest; 
    }

    inorderTraversal(apply: (node: HeadingNode<T>) => void, range: { begin: number, end: number }) {
        this.root.inorderTraversal(apply, range);
    }

    shiftLines(offset: number, begin: number) {
        let apply = (node: HeadingNode<T>) => {
            node.data.lineNbr += offset;
        };

        let range = { begin: begin, end: Number.POSITIVE_INFINITY };
        this.root.inorderTraversal(apply, range);
    }
    
    removeNode(node: HeadingNode<T>) {
        node.remove();
    }

    toString(): string {
        let result = "";
        const apply = (node: HeadingNode<T>) => {
            result += `${"   ".repeat(node.depth)}- ${node.toString()}\n`;
        };
        this.inorderTraversal(apply, { begin: 0, end: Number.POSITIVE_INFINITY });
        return result;
    }
}