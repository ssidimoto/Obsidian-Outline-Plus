

export class Heading{
    headLine: string;
    uiElem: htmlHeading;
    index: number[];
    
    constructor(headLine: string, index: number[], uiElem: htmlHeading){
        this.headLine = headLine;
        this.uiElem = uiElem;
        this.index = index
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