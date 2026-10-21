---
name: GitHub Release Workflow Publishing
description: Constraints when publishing QuickProp mobile release workflow changes through the connected GitHub integration.
---

GitHub Actions workflow files require the repository `workflow` permission. The GitHub connection can read and dispatch existing workflows and push ordinary source changes, but workflow-file pushes are rejected without that permission. Reauthorizing may still leave native git pushes denied.

**Why:** GitHub rejected a workflow-file push because the OAuth grant lacked `workflow`; reconnecting did not change the result, and a separate source-control connection was also rejected when updating or adding a release workflow. The contents API was unavailable as an alternative.

**How to apply:** Before planning a release workflow change, verify that the GitHub connection can update workflow files. If a push is rejected, do not retry through multiple connections. If safe, move CI wiring into a package/test command; otherwise stop and report that a maintainer must grant the GitHub app workflow permission or perform the workflow change in GitHub. Do not ask for credentials.