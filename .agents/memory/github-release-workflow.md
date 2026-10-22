---
name: GitHub Release Workflow Publishing
description: Constraints when publishing QuickProp mobile release workflow changes through the connected GitHub integration.
---

GitHub Actions workflow files require the repository `workflow` permission. The GitHub connection can read and dispatch existing workflows and push ordinary source changes, but workflow-file pushes are rejected without that permission. Reauthorizing may still leave native git pushes denied.

**Why:** GitHub rejected a workflow-file push because the OAuth grant lacked `workflow`; reconnecting did not change the result, and a separate source-control connection was also rejected when updating or adding a release workflow. The contents API was unavailable as an alternative.

**How to apply:** Before planning a release workflow change, verify that the GitHub connection can update workflow files. If a push is rejected, do not retry through multiple connections. If safe, move CI wiring into a package/test command; otherwise stop and report that a maintainer must grant the GitHub app workflow permission or perform the workflow change in GitHub. Do not ask for credentials.

## Android native build progress

Do not infer a stalled Android build from an unchanged GitHub run timestamp or a long-running Gradle step.

**Why:** A cold native build successfully took about 29 minutes while compiling multiple ABIs. An earlier attempt was interrupted unnecessarily because step-level status hid ongoing CMake work. Downloadable job logs became available after the job ended.

**How to apply:** Allow cold native compilation to finish. If a signed release artifact has already uploaded, optional debug APK work can be cancelled deliberately, but verify the artifact and signing steps first. A cancelled run's uploaded artifact remains usable by the separate submission workflow.

## Android version and track bookkeeping

Persist the highest submitted Android version code as the source baseline after a successful submission; the CI increment only affects its temporary checkout.

**Why:** Reusing a stale baseline generates a version code Google Play has already consumed. Uploading a bundle to Internal also consumes its code; moving it to Production requires promotion rather than uploading it again.

**How to apply:** Check the highest used Play version before building. For a new bundle intended directly for Production, prevent the automatic Internal upload, then use the manual submission workflow with that build's artifact. Never cancel native compilation merely to change tracks.