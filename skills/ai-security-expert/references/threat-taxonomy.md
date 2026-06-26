# Threat Taxonomy — AI Security Expert

## OWASP Top 10 (Application Security)

| # | Threat | Key Indicators |
|---|--------|----------------|
| A01 | Broken Access Control | Missing auth checks, IDOR, privilege escalation |
| A02 | Cryptographic Failures | Sensitive data in plaintext, weak algorithms |
| A03 | Injection | SQL, NoSQL, command, LDAP injection; unsanitized user input |
| A04 | Insecure Design | Missing threat modeling, no defense-in-depth |
| A05 | Security Misconfiguration | Default credentials, verbose errors, open cloud storage |
| A06 | Vulnerable Components | Outdated dependencies with known CVEs |
| A07 | Auth & Session Failures | Weak passwords, exposed tokens, bad session handling |
| A08 | Software Integrity Failures | Unverified packages, insecure CI/CD |
| A09 | Logging Failures | No audit trail, missing anomaly detection |
| A10 | SSRF | Unvalidated URL fetching, internal service exposure |

---

## OWASP LLM Top 10 (AI/LLM Security)

| # | Threat | Description |
|---|--------|-------------|
| LLM01 | Prompt Injection | Malicious input overrides system instructions |
| LLM02 | Insecure Output Handling | AI output rendered without validation (XSS, RCE risk) |
| LLM03 | Training Data Poisoning | Manipulated training data affects model behavior |
| LLM04 | Model Denial of Service | Expensive queries that exhaust resources |
| LLM05 | Supply Chain Vulnerabilities | Compromised plugins, models, or data sources |
| LLM06 | Sensitive Info Disclosure | Model reveals PII, secrets, or internal logic |
| LLM07 | Insecure Plugin Design | Plugins with excessive permissions or missing input validation |
| LLM08 | Excessive Agency | AI takes actions beyond intended scope |
| LLM09 | Overreliance | Trusting AI output without human/automated verification |
| LLM10 | Model Theft | Extracting model weights or proprietary behavior |

---

## AI Pipeline — Specific Attacks

### Prompt Injection Variants
| Variant | Description | Example |
|---------|-------------|---------|
| Direct Injection | User input overrides system prompt | "Ignore previous instructions and..." |
| Indirect Injection | Injected via tool output / retrieved data | Malicious content in a fetched URL |
| Stored Injection | Injected content persisted and re-executed later | Malicious DB record fed back to AI |
| Multi-turn Injection | Builds up over multiple turns before triggering | Gradual context poisoning |

### Inter-Skill Attacks
| Attack | Description |
|--------|-------------|
| Context Contamination | Skill A passes dirty context to Skill B |
| Schema Bypass | Malformed structured data that evades validation |
| Prompt Smuggling | Hiding instructions inside seemingly valid structured output |
| Skill Impersonation | Malicious skill masquerades as a trusted one |

---

## Severity Classification

| Severity | Criteria | Response |
|----------|----------|----------|
| **CRITICAL** | Direct exploit possible, data breach risk, system takeover | Block immediately, escalate |
| **HIGH** | Significant vulnerability, likely to be exploited | Fix before deployment |
| **MEDIUM** | Exploitable under specific conditions | Fix in next sprint |
| **LOW** | Defense-in-depth improvement | Track and address |
