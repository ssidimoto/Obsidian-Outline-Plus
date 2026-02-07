import { Itemhierarchy } from "./ItemHierarchy";


export class Heading extends Itemhierarchy{
    headLine: string;
    lineNbr: number;
    
    constructor(headLine: string, index: number[], lineNbr: number){
        super(index)
        this.headLine = headLine;
        this.lineNbr = lineNbr
    }
}

export class HtmlHeading extends Itemhierarchy{
    FolderEl: HTMLElement
    TitleEl: HTMLElement
    IconEl: HTMLElement
    childrens: HTMLElement
    isItem: boolean

    constructor(FolderEl: HTMLElement, TitleEl: HTMLElement, IconEl: HTMLElement, childrens: HTMLElement, isItem: boolean, index: number[]){
        super(index)
        this.FolderEl = FolderEl
        this.TitleEl = TitleEl
        this.IconEl = IconEl
        this.childrens = childrens
        this.isItem = isItem
    }
}