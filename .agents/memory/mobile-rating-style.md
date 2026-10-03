---
name: Mobile rating style
description: Consistent rating presentation and the reliable Search Watch confirmation behavior.
---

Use small yellow star icons for ratings throughout the mobile app; do not use star emoji. The Search detail sheet's Watched flow should present year and rating controls as an overlay inside the existing sheet modal, not as a nested native Modal.

**Why:** Star emoji are visually too heavy for Spud's simple cards, and nested native modals can fail to appear reliably in Expo Go/iOS.

**How to apply:** Use Feather star icons with yellow fill for selected values and a muted outline for unselected values. Keep the Watch confirmation overlay inside the parent detail-sheet modal.