import { setIcon } from "obsidian";
import { setTooltip } from "obsidian"
import { SETTINGS } from "../main";
import { ParametersData } from "../datatypes/Parameters"; // Adjust import path as needed
import { ParamUpdateAction } from "views/ViewModel/TreeFileViewModel";

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
    const menuEl = createDiv();
    menuEl.className = "menu context-menu-root";
    menuEl.setCssStyles({ left: `${x}px`, top: `${y}px` });
    //add mouse hoover

    menuEl.createDiv({ cls: "menu-grabber" });
    const scrollEl = menuEl.createDiv({ cls: "menu-scroll" });
    const groupEl = scrollEl.createDiv({ cls: "menu-group" });

    // Single exit path: picking an item and clicking away must both drop the listener
    // below, otherwise every use of the menu leaves one behind holding a detached tree.
    const close = () => {
        menuEl.remove();
        document.removeEventListener("click", closeHandler, true);
    };

    const closeHandler = (e: MouseEvent) => {
        if (!menuEl.contains(e.target as Node)) close();
    };

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
            close();
        });
    };

    addItem("chevrons-down-up", "Collapse", "action-expand", actions?.onCollapse);
    addItem("chevrons-up-down", "Expand", "action-collapse", actions?.onExpand);
    addItem("rotate-cw", "Refresh", "action-refresh", actions?.refresh);

    document.body.appendChild(menuEl);

    window.setTimeout(() => {
        document.addEventListener("click", closeHandler, true);
    }, 0);

    return menuEl;
}

// --- Helper Functions ---

export function createGearIcon(onChange: (action: ParamUpdateAction, val: number) => void): HTMLElement {
    // Rely on global CSS for button styling
    const buttonEl = createEl("button");
    buttonEl.className = "clickable-icon graph-controls-button file-outline-params-button";
    buttonEl.setAttribute("aria-label", "Settings");
    setIcon(buttonEl, "wrench");

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

        // Position menu with viewport bounds checking. The menu is already in the DOM, so
        // its real box is measurable and its size does not have to be duplicated here.
        const rect = buttonEl.getBoundingClientRect();
        const menuRect = menuEl.getBoundingClientRect();
        const margin = 8;

        let left = rect.right - menuRect.width;
        if (left < margin) left = margin;
        if (left + menuRect.width > window.innerWidth - margin) {
            left = window.innerWidth - menuRect.width - margin;
        }

        let top = rect.bottom + margin;
        if (top + menuRect.height > window.innerHeight) top = rect.top - menuRect.height - margin;
        if (top < margin) top = margin;

        // Only the position is dynamic; every static rule lives in styles.css.
        menuEl.setCssStyles({
            left: `${left}px`,
            top: `${top}px`,
        });

        window.setTimeout(() => {
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
    const menuEl = createDiv();
    menuEl.className = "menu file-outline-params-menu";

    // Compact Header
    menuEl.createDiv({ cls: "file-outline-params-title", text: "Parameters" });

    // Reusable ultra-compact setting row builder
    const createSetting = (
        label: string,
        tooltipText: string,
        type: "number" | "checkbox",
        value: number | boolean,
        onInput: (v: number | boolean) => void
    ) => {
        const row = menuEl.createDiv({ cls: "setting-item file-outline-params-row" });

        // Left side: Label + Hover Info Icon
        const nameEl = row.createDiv({ cls: "setting-item-name file-outline-params-name" });

        nameEl.createSpan({ text: label });

        // Subtle info icon (ⓘ) that reveals description on hover
        nameEl.createSpan({ cls: "file-outline-params-info", text: "ⓘ" });

        // Attach Obsidian native tooltip
        setTooltip(nameEl, tooltipText, { placement: "left", delay: 300, classes: ["file-outline-tooltip"] });

        // Right side: Compact Control
        const control = row.createDiv({ cls: "setting-item-control file-outline-params-control" });

        const input = control.createEl("input", { type });

        if (type === "checkbox") {
            input.classList.add("file-outline-params-checkbox");
            input.checked = value as boolean;
            input.addEventListener("change", () => onInput(input.checked));
        } else {
            input.classList.add("file-outline-params-number");
            input.value = String(value);

            // Vérification initiale lors de l'affichage
            if (typeof value === "number" && value < 0) {
                input.classList.add("is-invalid");
            }

            input.addEventListener("input", () => {
                const num = Number.parseFloat(input.value);

                // Si la valeur est négative ou non valide (NaN)
                if (Number.isNaN(num) || num < 0) {
                    input.classList.add("is-invalid");
                    // N'appelle PAS onInput(num)
                } else {
                    // Rétablissement du style par défaut et déclenchement du callback
                    input.classList.remove("is-invalid");
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
        (v) => { onChange(ParamUpdateAction.collapseDepth, v as number); }
    );

    createSetting(
        "Refresh rate (ms)",
        "It is the smaller interval between file index updates",
        "number",
        params.refreshRate,
        (v) => { onChange(ParamUpdateAction.refreshRate, v as number); }
    );

    createSetting(
        "Dynamic collapse diff",
        "If the depth difference between adjacent headings is greater than this value, the deeper heading will be collapsed",
        "number",
        params.dynamicCollapseDepthDiff,
        (v) => { onChange(ParamUpdateAction.dynamicCollapseDepthDiff, v as number); }
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
