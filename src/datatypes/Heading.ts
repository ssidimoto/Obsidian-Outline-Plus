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

export class htmlHeading extends Itemhierarchy{
    headingContainer: HTMLElement;
    heading: HTMLElement;
    subHeading: HTMLElement;
    displayed: Boolean;
    index: number[];

    constructor(headingContainer: HTMLElement, heading: HTMLElement, 
        subHeading: HTMLElement, displayed: Boolean = true, index: number[]){
        super(index)
        this.headingContainer = headingContainer;
        this.heading = heading;
        this.subHeading = subHeading;
        this.displayed = false
        this.displayed = displayed

    }
}