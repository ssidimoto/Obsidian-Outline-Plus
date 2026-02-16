import { Head } from "rxjs";
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
    equals(other: Heading): boolean {
        return this.headLine === other.headLine && this.lineNbr === other.lineNbr && this.width === other.width
    }

    override copy(changes: Partial<this>): this {
        return new Heading(
            changes.headLine ?? this.headLine,
            changes.lineNbr ?? this.lineNbr,
            changes.width ?? this.width
        ) as this;
}

    toString(): string {
        return `Heading: ${this.headLine}, Line: ${this.lineNbr}, Width: ${this.width}`
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

    equals(other: HtmlHeading): boolean {
        return this.TitleEl.innerText === other.TitleEl.innerText && this.lineNbr === other.lineNbr && this.width === other.width
    }

    copy(changes: Partial<HtmlHeading>): HtmlHeading {
        return new HtmlHeading(
            changes.FolderEl ?? this.FolderEl,
            changes.TitleEl ?? this.TitleEl,
            changes.IconEl ?? this.IconEl,
            changes.childrens ?? this.childrens,
            changes.isItem ?? this.isItem,
            changes.lineNbr ?? this.lineNbr,
            changes.width ?? this.width
        )
    }
}