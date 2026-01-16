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

export class htmlHeading{
    headingContainer: HTMLElement;
    heading: HTMLElement;
    subHeading: HTMLElement;
    displayed: Boolean;

    constructor(headingContainer: HTMLElement, heading: HTMLElement, subHeading: HTMLElement, displayed: Boolean = true){
        this.headingContainer = headingContainer;
        this.heading = heading;
        this.subHeading = subHeading;
        this.displayed = false
        this.displayed = displayed
    }
}