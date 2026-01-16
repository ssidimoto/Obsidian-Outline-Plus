export class Itemhierarchy{
    index: number[]

    constructor(index: number[]){
        this.index = index
    }
}

export class Heading extends Itemhierarchy{
    headLine: string;
    constructor(headLine: string, index: number[]){
        super(index)
        this.headLine = headLine;
    }

}