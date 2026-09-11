---
name: OpenAPI contract shape
description: A durable reminder about OpenAPI nesting and generated-client reliability in this workspace.
---

Every OpenAPI path operation must keep its complete request and response definitions directly nested under that HTTP method. A sibling operation inserted before an unfinished response block can make the YAML parse ambiguously or cause Orval to report an unhelpful input-resolution error.

**Why:** The generated React and Zod clients are the contract boundary for the Office and mobile apps, so a structurally valid-looking but incorrectly nested path can remove generated files before the real error is obvious.

**How to apply:** After editing `lib/api-spec/openapi.yaml`, inspect the surrounding method indentation and run the API-spec code generator before changing frontend consumers.

OpenAPI `format: email` fields currently generate `zod.email()` in this workspace, which is unavailable in the installed Zod 3 runtime; use a plain string schema unless the Zod version is intentionally upgraded.

**Why:** A contract can be valid OpenAPI and still break the generated server validator during the required library typecheck.

**How to apply:** When adding email-shaped fields, validate the format at the application boundary or upgrade Zod deliberately; do not add the OpenAPI email format casually.