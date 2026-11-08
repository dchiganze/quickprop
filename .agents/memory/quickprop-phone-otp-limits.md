---
name: QuickProp Phone OTP Limits
description: Environment scope and privacy constraints for Twilio Verify send throttling.
---

Persist OTP send attempts before calling Twilio, identify phone numbers with a keyed hash rather than storing them, and count failed provider sends. Keep Fraud Guard enabled and never retry a blocked or failed send automatically.

**Why:** A provider failure still consumes a send attempt, and Twilio may be shared while Replit's development and production databases are separate.

**How to apply:** Enforce the per-phone cooldown and rolling window atomically in the server database. If development and production use the same Verify service, explain that independent counters can add together; do not introduce shared storage without discussing the tradeoff.
