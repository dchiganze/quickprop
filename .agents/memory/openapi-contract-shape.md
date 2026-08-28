---
name: OpenAPI contract shape
description: A durable reminder about OpenAPI nesting and generated-client reliability in this workspace.
---

Every OpenAPI path operation must keep its complete request and response definitions directly nested under that HTTP method. A sibling operation inserted before an unfinished response block can make the YAML parse ambiguously or cause Orval to report an unhelpful input-resolution error.

**Why:** The generated React and Zod clients are the contract boundary for the Office and mobile apps, so a structurally valid-looking but incorrectly nested path can remove generated files before the real error is obvious.

**How to apply:** After editing `lib/api-spec/openapi.yaml`, inspect the surrounding method indentation and run the API-spec code generator before changing frontend consumers.