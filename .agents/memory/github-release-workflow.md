---
name: GitHub Release Workflow Publishing
description: Constraints when publishing QuickProp mobile release workflow changes through the connected GitHub integration.
---

GitHub Actions workflow files require the repository `workflow` permission. The GitHub connection can read and dispatch existing workflows and push ordinary source changes, but workflow-file pushes are rejected without that permission. Reauthorizing may still leave native git pushes denied.

**Why:** GitHub rejected a release-branch push specifically because the OAuth grant lacked `workflow`; a reconnect was approved but the push was rejected again. The contents API and connector proxy were also unavailable for workflow-file updates.

**How to apply:** Before planning a release workflow change, verify that the GitHub connection can update workflow files. If a push is rejected, do not keep retrying after one reconnect. If safe, move CI environment wiring into the test command or application code instead; otherwise report that the workflow needs a GitHub path with workflow permission. Do not create replacement certificates or ask for credentials.