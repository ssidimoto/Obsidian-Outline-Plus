import { setIcon } from "obsidian";
import { setTooltip } from "obsidian"
import { DEFAULT_SETTINGS } from "global";
import { ParametersData } from "../ViewModel/ParametersViewModel"; // Adjust import path as needed

let activeParametersMenu: HTMLElement | null = null;

/**
 * UI 2: Returns an HTMLElement for the context menu (Expand, Collapse, Fix box).
 */
export function createContextMenuUI(
    x: number,
    y: number,
    actions?: {
        onExpand?: () => void;
        onCollapse?: () => void;
        refresh?: () => void;
    }
): HTMLElement {
    const menuEl = document.createElement("div");
    menuEl.className = "menu context-menu-root";
    menuEl.style.left = `${x}px`;
    menuEl.style.top = `${y}px`;
    //add mouse hoover

    menuEl.createDiv({ cls: "menu-grabber" });
    const scrollEl = menuEl.createDiv({ cls: "menu-scroll" });
    const groupEl = scrollEl.createDiv({ cls: "menu-group" });

    const addItem = (iconName: string, title: string, sectionId: string, onClick?: () => void) => {
        const itemEl = groupEl.createDiv({
            cls: "menu-item tappable",
            attr: { "data-section": sectionId },
        });
        //hoover when mouse over item


        const iconBox = itemEl.createDiv({ cls: "menu-item-icon" });
        setIcon(iconBox, iconName);

        itemEl.createDiv({ cls: "menu-item-title", text: title });

        itemEl.addEventListener("click", (e) => {
            e.stopPropagation();
            if (onClick) onClick();
            menuEl.remove();
        });
    };

    addItem("chevrons-down-up", "Collapse", "action-expand", actions?.onCollapse);
    addItem("chevrons-up-down", "Expand", "action-collapse", actions?.onExpand);
    addItem("pin", "Refresh", "action-refresh", actions?.refresh);

    // Close on click outside
    const closeHandler = (e: MouseEvent) => {
        if (!menuEl.contains(e.target as Node)) {
            menuEl.remove();
            document.removeEventListener("click", closeHandler, true);
        }
    };

    document.body.appendChild(menuEl);

    setTimeout(() => {
        document.addEventListener("click", closeHandler, true);
    }, 0);

    return menuEl;
}

// --- Helper Functions ---

export function createGearIcon(
    paramsData: ParametersData = DEFAULT_SETTINGS,
    onChange: (updatedData: ParametersData) => void = () => {}
): HTMLElement {
    // Rely on global CSS for button styling
    const buttonEl = document.createElement("button");
    buttonEl.className = "clickable-icon graph-controls-button";
    buttonEl.setAttribute("aria-label", "Settings");
    setIcon(buttonEl, "settings");
    buttonEl.style.display = "inline-flex";
    buttonEl.style.alignItems = "center";
    buttonEl.style.justifyContent = "center";

    let menuEl: HTMLElement | null = null;
    let listeners: { listener: EventListener; type: string; options: boolean | AddEventListenerOptions }[] = [];

    const removeAllListeners = () => {
        listeners.forEach(({ listener, type, options }) => {
            document.removeEventListener(type, listener, options);
        });
        listeners = [];
    };

    // A single, clean event listener for closing the menu
    const handleClose = (e?: Event) => {
        if (e && (e.target === buttonEl || menuEl?.contains(e.target as Node))) return;
        if (e instanceof KeyboardEvent && e.key !== "Escape") return;
        
        menuEl?.remove();
        menuEl = null;
        buttonEl.classList.remove("mod-open");
        removeAllListeners();
    };

    buttonEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (menuEl) return handleClose();

        buttonEl.classList.add("mod-open");
        menuEl = buildParametersMenu(paramsData, onChange);
        document.body.appendChild(menuEl);

        // Position menu with viewport bounds checking
        const rect = buttonEl.getBoundingClientRect();
        const margin = 8;
        let left = rect.right - 250;
        let top = rect.bottom + margin;

        // Clamp to viewport
        if (left < margin) left = margin;
        if (left + 250 > window.innerWidth - margin) left = window.innerWidth - 250 - margin;
        if (top + 300 > window.innerHeight) top = rect.top - 300 - margin;
        if (top < margin) top = margin;

        Object.assign(menuEl.style, {
            position: "fixed",
            left: `${left}px`,
            top: `${top}px`,
            zIndex: "1000",
            width: "250px"
        });

        setTimeout(() => {
            const onMouseDown = (handleClose as EventListener);
            const onEscape = ((e: KeyboardEvent) => {
                if (e.key === "Escape") handleClose(e);
            }) as EventListener;
            
            document.addEventListener("mousedown", onMouseDown, true);
            document.addEventListener("keydown", onEscape, true);
            
            listeners.push(
                { listener: onMouseDown, type: "mousedown", options: true },
                { listener: onEscape, type: "keydown", options: true }
            );
        }, 0);
    });

    return buttonEl;
}


function buildParametersMenu(params: ParametersData, onChange: (updatedData: ParametersData) => void): HTMLElement {
    const menuEl = document.createElement("div");
    menuEl.className = "menu compact-parameters-menu";

    // Compact Header
    const titleEl = menuEl.createDiv({ text: "Parameters" });
    titleEl.style.cssText = `
        padding: 6px 10px 4px 10px;
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        border-bottom: 1px solid var(--background-modifier-border);
        margin-bottom: 4px;
    `;

    // Reusable ultra-compact setting row builder
    const createSetting = (
        label: string, 
        tooltipText: string, 
        type: "number" | "checkbox", 
        value: any, 
        onInput: (v: any) => void
    ) => {
        const row = menuEl.createDiv({ cls: "setting-item" });
        // Strip out default Obsidian setting paddings and borders for maximum compactness
        row.style.cssText = `
            border: none;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-radius: 0px;
            margin-bottom: 0px;
        `;

        // Left side: Label + Hover Info Icon
        const nameEl = row.createDiv({ cls: "setting-item-name" });
        nameEl.style.cssText = `
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: help;
            white-space: nowrap;
        `;

        nameEl.createSpan({ text: label });

        // Subtle info icon (ⓘ) that reveals description on hover
        const infoIcon = nameEl.createSpan({ text: "ⓘ" });
        infoIcon.style.cssText = "font-size: 0.75rem; color: var(--text-muted); opacity: 0.7;";

        // Attach Obsidian native tooltip (falls back to native title attribute if needed)
        setTooltip(nameEl, tooltipText, { placement: "right", delay: 300});        

        // Right side: Compact Control
        const control = row.createDiv({ cls: "setting-item-control" });
        control.style.margin = "0";

        const input = control.createEl("input", { type });

        if (type === "checkbox") {
            input.checked = value;
            input.style.cssText = "cursor: pointer; margin: 0;";
            input.addEventListener("change", () => onInput(input.checked));
        } else {
            input.value = String(value);
            input.style.cssText = `
                width: 44px;
                height: 22px;
                padding: 0 4px;
                text-align: right;
                font-size: 0.8rem;
                background: var(--background-modifier-form-field);
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
            `;
            input.min = "0";
            input.step = "1";

            const syncValidity = () => {
                const parsed = Number.parseFloat(input.value);
                const isNegative = !Number.isNaN(parsed) && parsed < 0;

                input.style.borderColor = isNegative ? "var(--text-error)" : "var(--background-modifier-border)";
                input.style.boxShadow = isNegative ? "0 0 0 1px var(--text-error)" : "";

                return !isNegative && !Number.isNaN(parsed);
            };

            input.addEventListener("input", () => {
                const num = Number.parseFloat(input.value);
                const isValid = syncValidity();
                if (isValid) onInput(num);
            });

            syncValidity();
        }
    };

    // Settings Definitions
    createSetting(
        "Collapse depth", 
        "Index depth when resting", 
        "number", 
        params.collapseDepth, 
        (v) => { params.collapseDepth = v; onChange(params); }
    );

    createSetting(
        "Refresh rate", 
        "Minimal time between file index updates", 
        "number", 
        params.refreshRate, 
        (v) => { params.refreshRate = v; onChange(params); }
    );

    createSetting(
        "Dynamic collapse diff", 
        "Tolerated index depth visible around current heading", 
        "number", 
        params.dynamicCollapseDepthDiff, 
        (v) => { params.dynamicCollapseDepthDiff = v; onChange(params); }
    );

    createSetting(
        "Manual update", 
        "No automatic update, only manual update with left click", 
        "checkbox", 
        params.manualUpdate, 
        (v) => { params.manualUpdate = v; onChange(params); }
    );

    return menuEl;
}