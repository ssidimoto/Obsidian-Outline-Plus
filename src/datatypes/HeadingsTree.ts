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

    addNode(node: HeadingNode<T>) {
        // 1. Trouver l'index d'insertion basé sur le numéro de ligne (lineNbr)
        let insertIndex = 0;
        while (
            insertIndex < this.childrens.length &&
            this.childrens[insertIndex]!.data.lineNbr < node.data.lineNbr
        ) {
            insertIndex++;
        }

        // 2. Si le titre précédent a une hiérarchie plus grande (depth plus petit),
        // on redirige le nouveau nœud pour qu'il soit inséré à l'intérieur de celui-ci.
        if (insertIndex > 0) {
            const prevChild = this.childrens[insertIndex - 1]!;
            if (node.depth > prevChild.depth) {
                prevChild.addNode(node);
                return;
            }
        }

        // 3. Insérer le nœud à cet endroit précis
        this.childrens.splice(insertIndex, 0, node);
        node.parent = this;

        // 4. Extraire les sous-titres du "titre précédent" qui se trouvent physiquement 
        // APRÈS la ligne de notre nouveau titre, et les donner à notre nouveau titre.
        if (insertIndex > 0) {
            const prevChild = this.childrens[insertIndex - 1]!;
            this.transferNodesAfter(prevChild, node, node.data.lineNbr);
        }

        // 5. Adopter tous les frères (siblings) suivants qui ont une hiérarchie plus faible (depth plus grand)
        let checkIndex = insertIndex + 1;
        while (checkIndex < this.childrens.length) {
            const nextSibling = this.childrens[checkIndex]!;
            // Si le frère a une hiérarchie inférieure (ex: node est H1(1), nextSibling est H2(2))
            if (nextSibling.depth > node.depth) {
                // On l'enlève de la liste des frères
                const adopted = this.childrens.splice(checkIndex, 1)[0]!;
                // Et on demande au nouveau nœud de l'adopter
                node.addNode(adopted);
                // Note: On n'incrémente pas checkIndex car le tableau s'est décalé vers la gauche
            } else {
                // On s'arrête dès qu'on tombe sur un titre de même niveau ou de niveau supérieur
                break; 
            }
        }
    }

    /**
     * Parcourt récursivement (et à l'envers pour sécuriser les suppressions) un nœud source.
     * Transfère tous les nœuds se trouvant après 'thresholdLine' vers le nœud 'target'.
     */
    private transferNodesAfter(source: HeadingNode<T>, target: HeadingNode<T>, thresholdLine: number) {
        for (let i = source.childrens.length - 1; i >= 0; i--) {
            const child = source.childrens[i]!;
            if (child.data.lineNbr > thresholdLine) {
                // Ce nœud (et tous ses enfants implicitement) est retiré de la source
                const removed = source.childrens.splice(i, 1)[0]!;
                // Et transféré à la cible
                target.addNode(removed);
            } else {
                // Si l'enfant est avant la ligne, certains de SES propres enfants sont peut-être après.
                this.transferNodesAfter(child, target, thresholdLine);
            }
        }
    }

    remove() {
        if (!this.parent) return; // Sécurité
        this.parent.childrens = this.parent.childrens.filter((child) => !child.equals(this));

        const orphans = [...this.childrens];
        this.childrens = [];
        
        // Les orphelins sont réinsérés en toute sécurité.
        orphans.forEach((child) => {
            this.parent.addNode(child); 
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
        this.root.addNode(node);
    }

    findClosestNode(lineNbr: number): HeadingNode<T> | undefined {
        if (this.root.childrens.length === 0) return undefined;
        if (lineNbr < this.root.childrens[0]!.data.lineNbr) return this.root.childrens[0];
        
        const closest = this.root.findClosestNode(lineNbr);
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