export abstract class Itemhierarchy{
    lineNbr: number;
    width: number;

    constructor(lineNbr: number, width: number){
        this.lineNbr = lineNbr
        this.width = width
    }

    abstract equals(other: Itemhierarchy): boolean;

    abstract copy(changes: Partial<this>): this
}