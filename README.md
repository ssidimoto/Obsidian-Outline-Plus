# Advanced Outline for Obsidian

A high-performance, context-aware, and feature-packed document outline sidebar for Obsidian.

> **Fun Fact:** I actually built this entire plugin from scratch before realizing that Obsidian *already* had a built-in core Outline plugin! Once I discovered the native one, I realized my custom implementation was significantly more responsive, flexible, and feature-rich—so I decided to polish and release it anyway.

---

## Key Features

*  **Auto-Sync & Active Position Tracking:** Automatically unfolds parent headings and tracks your exact reading/cursor position as you scroll through long markdown files.
* **Near-Instant Performance:** Built using an optimized single-pass document parser that completely avoids heavy line-splitting, ensuring near-instantaneous outline generation even on massive notes.
* $\sum$ **Inline LaTeX Rendering:** Full support for inline math equations (e.g., `$E = mc^2$`) directly rendered inside heading nodes in the tree view.
* **Custom Parameter Engine:** Fine-tune every aspect of how the outline behaves—from auto-collapse rules to indexing refresh rates.
   **Granular Subtree Controls:** Built-in context menu (right-click) to expand or collapse complete subtrees recursively or manually trigger index refreshes.

---

## Parameter Settings

Click the gear icon in the outline header to tweak the dynamic parameters:

| Parameter | Description |
| --- | --- |
| **Collapse depth** | Sets the default baseline depth level when the index is resting. |
| **Refresh rate** | Defines the minimal time interval required between two consecutive index updates. |
| **Dynamic collapse diff** | Sets the tolerated depth range visible around the currently active heading. |
| **Manual update** | Toggles whether the index updates automatically on file edits or manually on demand. |

---

## Subtree Context Menu Actions

Right-click on any heading in the outline view to access granular controls:

* **Expand Subtree:** Expands the selected node and all of its nested children sequentially.
* **Collapse Subtree:** Recursively closes all nested child headings under the selected node.
* **Refresh Index:** Forces an immediate re-scan and sync of the active document's heading tree.

* small preview :
* <img width="1606" height="1125" alt="image" src="https://github.com/user-attachments/assets/c6bffb54-41cd-4f3f-b91a-bb2ab73288e5" />
