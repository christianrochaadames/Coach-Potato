---
name: Publish uniqueness safety
description: A publish-time uniqueness warning can offer truncation even when existing values are already unique
---

When publishing a new uniqueness constraint, do not interpret a truncation prompt as proof that production data conflicts.

**Why:** Publishing the Facebook identifier constraint offered to truncate profiles even though a production read-only check found zero duplicate non-null identifiers. The computed schema diff itself contained no drops or truncations.

**How to apply:** Inspect the publish schema diff and verify existing values with a production read-only query. When values are already unique, preserve production data and apply the constraint without truncating. Never select overwrite-data merely to apply a schema update, and never add production migration scripts or startup DDL; managed production schema updates belong to Publish.