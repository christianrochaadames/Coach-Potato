---
name: Workspace environment label
description: The environment label alone has not reliably identified this project's database target
---

Do not assume the workspace database is production solely because `REPLIT_ENVIRONMENT` says `production`.

**Why:** The workspace reported that label while its database had a development-only schema addition that the production read-only query confirmed was absent. A production-only test guard incorrectly refused legitimate development tests.

**How to apply:** Confirm ambiguous targets with safe database metadata against explicit development/production query contexts. Keep mutating fixtures workspace-only; never override a guard without confirming the actual target, and never inspect or print database credentials.