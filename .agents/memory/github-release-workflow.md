---
name: GitHub Release Workflow Publishing
description: Constraints when publishing QuickProp mobile release workflow changes through the connected GitHub integration.
---

GitHub Actions workflow files require a connection with the repository `workflow` permission. A connection that only has `repo` access can read and dispatch existing workflows but cannot push commits that create or update files under `.github/workflows/`.

**Why:** GitHub rejected a release-branch push specifically because the OAuth grant lacked `workflow`. Reauthorizing through the available connection did not expose that permission, and both the contents API and native GitHub client were blocked by the connector's Cloudflare proxy.

**How to apply:** Before planning a release workflow change, verify that the GitHub connection can update workflow files. If it cannot, keep the change local and report that the workflow must be updated through a GitHub path with workflow permission; do not create replacement certificates or ask the user to paste credentials.