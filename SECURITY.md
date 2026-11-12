# Security Policy

## Reporting a Vulnerability

Because Marmalade is designed for children and families, we treat security and child privacy with the utmost seriousness.

If you believe you have found a security vulnerability, authentication bypass, or privacy boundary flaw in Marmalade, please **do not open a public GitHub issue**.

Instead, please report it through **GitHub Private Vulnerability Reporting**:
1. Navigate to the repository's [**Security** tab](https://github.com/j-nilesh/marmalade/security) on GitHub.
2. Click **Report a vulnerability** under Private vulnerability reporting.
3. Include details, steps to reproduce, and potential impact.

We will acknowledge receipt within 48 hours and work with you on a coordinated fix and credit.

---

## Architectural Security Model

Marmalade enforces privacy and security at the server level:

1. **Authentication & Session Security**:
   - Separate parent and child roles with `scrypt` password hashing and per-user cryptographic salts.
   - Session tokens are hashed with SHA-256 and stored in SQLite, delivered in `HttpOnly`, `SameSite=Lax` cookies (`marmalade_session`, with fallback to `sprout_session` (legacy, from the pre-rename build)).
   - Dedicated CSRF protection header (`X-Marmalade-CSRF`, with fallback to `X-Sprout-CSRF` (legacy, from the pre-rename build), or `x-csrf-token`) is enforced on all mutating requests.
   - Parent sessions automatically time out after 15 minutes of inactivity (`PARENT_SESSION_TTL_MS`).
   - Brute-force protection tracks failed attempts per client IP and per `(IP + username)` pair with bounded memory sweeps.
   - Sensitive AI provider API keys are encrypted at rest with AES-256-GCM using an instance secret generated on first run.

2. **Personal Identifiable Information (PII) Redaction**:
   - Pre-egress heuristic filtering catches common patterns (emails, phone numbers, street addresses, school names, full names) before prompts reach a cloud provider. It's a safety net, not a guarantee. For complete data isolation from commercial providers, families can run 100% locally via Ollama.

3. **No External Telemetry or CDNs**:
   - 100% of assets (fonts, icons, and illustrations) are served directly by the self-hosted instance.
   - Zero analytics, trackers, or third-party logging services are included in the codebase.
   - Strict Content Security Policy (`default-src 'self'`) and security headers (`HSTS`, `X-Content-Type-Options: nosniff`) prevent unauthorized egress and script execution.

4. **Transient Conversations & Application Boundary**:
   - In-memory conversation turns expire after 15 minutes of inactivity, on logout, or on server restart. Only work the child explicitly chooses to save is persisted to the local SQLite database.
   - Parental "no surveillance" is strictly enforced within the application UI and API surface. As with any self-hosted software, an administrator with direct shell or filesystem access to the host machine can inspect persisted files.
