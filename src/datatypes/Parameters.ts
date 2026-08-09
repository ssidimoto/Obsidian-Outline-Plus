//parameter data class with collapse depth, refresh rate, manual update, and dynamic collapse depth diff collapse
export class ParametersData {
    collapseDepth: number;
    refreshRate: number;
    manualUpdate: boolean;
    dynamicCollapseDepthDiff: number;

    constructor(collapseDepth: number, refreshRate: number, manualUpdate: boolean, dynamicCollapseDepthDiff: number) {
        this.collapseDepth = collapseDepth;
        this.refreshRate = refreshRate;
        this.manualUpdate = manualUpdate;
        this.dynamicCollapseDepthDiff = dynamicCollapseDepthDiff;
    }
}

