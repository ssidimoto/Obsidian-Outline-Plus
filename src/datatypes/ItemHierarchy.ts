export abstract class Itemhierarchy{
    lineNbr: number;
    width: number;

    constructor(lineNbr: number, width: number){
        this.lineNbr = lineNbr
        this.width = width
    }

    abstract equals(other: Itemhierarchy): boolean;

    abstract copy(changes: Partial<this>): this

    /** Default stringification, kept identical to the inherited `Object` behaviour. */
    toString(): string {
        return Object.prototype.toString.call(this);
    }
}
