import { setIcon } from "obsidian";
import { setTooltip } from "obsidian"
import { SETTINGS } from "../../main";
import { ParametersData } from "../../datatypes/Parameters"; // Adjust import path as needed
import { ParamUpdateAction } from "views/ViewModel/TreeFileViewModel";

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

export function createGearIcon(onChange: (action: ParamUpdateAction, val: number) => void): HTMLElement {
    // Rely on global CSS for button styling
    const buttonEl = document.createElement("button");
    buttonEl.className = "clickable-icon graph-controls-button";
    buttonEl.setAttribute("aria-label", "Settings");
    setIcon(buttonEl, "wrench");
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
        menuEl = buildParametersMenu(SETTINGS, onChange);
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


function buildParametersMenu(params: ParametersData, onChange: (action: ParamUpdateAction, val: number) => void): HTMLElement {
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

        // Attach Obsidian native tooltip
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

            // Vérification initiale lors de l'affichage
            if (typeof value === "number" && value < 0) {
                input.style.borderColor = "var(--text-error)";
                input.style.color = "var(--text-error)";
            }

            input.addEventListener("input", () => {
                const num = Number.parseFloat(input.value);

                // Si la valeur est négative ou non valide (NaN)
                if (Number.isNaN(num) || num < 0) {
                    input.style.borderColor = "var(--text-error)";
                    input.style.color = "var(--text-error)";
                    // N'appelle PAS onInput(num)
                } else {
                    // Rétablissement du style par défaut et déclenchement du callback
                    input.style.borderColor = "var(--background-modifier-border)";
                    input.style.color = "var(--text-normal)";
                    onInput(num);
                }
            });
        }
    };

    // Settings Definitions
    createSetting(
        "Collapse depth", 
        "any heading that has a depth greater than this value will be collapsed", 
        "number", 
        params.collapseDepth, 
        (v) => { onChange(ParamUpdateAction.collapseDepth, v); }
    );

    createSetting(
        "Refresh rate (ms)", 
        "It is the smaller interval between file index updates", 
        "number", 
        params.refreshRate, 
        (v) => { onChange(ParamUpdateAction.refreshRate, v); }
    );

    createSetting(
        "Dynamic collapse diff", 
        "If the depth difference between adjacent headings is greater than this value, the deeper heading will be collapsed", 
        "number", 
        params.dynamicCollapseDepthDiff, 
        (v) => { onChange(ParamUpdateAction.dynamicCollapseDepthDiff, v); }
    );

    createSetting(
        "Manual update", 
        "There is no automatic update, only manual ones with refresh button", 
        "checkbox", 
        params.manualUpdate, 
        (v) => { 
            let val = v ? 1 : 0;
            onChange(ParamUpdateAction.manualUpdate, val);
        }
    );

    return menuEl;
}