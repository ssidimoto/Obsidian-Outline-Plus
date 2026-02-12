import { Itemhierarchy } from "./ItemHierarchy";


export class Heading extends Itemhierarchy{
    headLine: string;

    constructor(headLine: string, 
        lineNbr: number, 
        width: number
    ){
        super(lineNbr, width)
        this.headLine = headLine;
        this.width = width;
    }
}

export class HtmlHeading extends Itemhierarchy{
    FolderEl: HTMLElement
    TitleEl: HTMLElement
    IconEl: HTMLElement
    childrens: HTMLElement
    isItem: boolean

    constructor(
        FolderEl: HTMLElement, 
        TitleEl: HTMLElement, 
        IconEl: HTMLElement, 
        childrens: HTMLElement, 
        isItem: boolean, 
        lineNbr: number, 
        width: number
    ){
        super(lineNbr, width)
        this.FolderEl = FolderEl
        this.TitleEl = TitleEl
        this.IconEl = IconEl
        this.childrens = childrens
        this.isItem = isItem
    }
}