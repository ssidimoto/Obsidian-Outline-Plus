export class Itemhierarchy{
    index: number[]

    constructor(index: number[]){
        this.index = index
    }

    compare(item: Itemhierarchy){
        for (let i = 0; i < Math.min(this.index.length, item.index.length); i++) {
            const a = this.index[i];
            const b = item.index[i];

            if(a == undefined) return false 
            else if(b == undefined) return true

            if (a < b) return true;
            if(a > b) return false;
        }
        throw Error("there are two same level heeadings")
    }
}

export class Heading extends Itemhierarchy{
    headLine: string;
    constructor(headLine: string, index: number[]){
        super(index)
        this.headLine = headLine;
    }

}