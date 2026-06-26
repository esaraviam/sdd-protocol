# Implementation Patterns — AI Security Expert

## Table of Contents
1. [Input Sanitization (Node.js / TypeScript)](#1-input-sanitization)
2. [Prompt Firewall Middleware](#2-prompt-firewall-middleware)
3. [AI Output Validator (Zod)](#3-ai-output-validator)
4. [Inter-Skill Contract Types](#4-inter-skill-contract-types)
5. [React / Next.js — Safe Input Hook](#5-react--nextjs--safe-input-hook)
6. [Audit Logger](#6-audit-logger)

---

## 1. Input Sanitization

```typescript
import { z } from 'zod';

// Generic sanitizer — strips control characters and limits length
export function sanitizeInput(raw: string, maxLength = 2000): string {
  return raw
    .replace(/[\x00-\x1F\x7F]/g, '') // strip control chars
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .slice(0, maxLength)
    .trim();
}

// Schema-first validation — always reject, never auto-correct
export function validateInput<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Log the attempt before rejecting
    console.warn('[SECURITY] Input validation failed:', result.error.flatten());
    throw new Error('Invalid input — rejected by security contract');
  }
  return result.data;
}
```

---

## 2. Prompt Firewall Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+a/i,
  /system\s*:/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /assistant\s*:/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

export function promptFirewall(req: Request, res: Response, next: NextFunction) {
  const body = JSON.stringify(req.body ?? '');

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(body)) {
      // Audit log — never silently drop
      console.warn('[SECURITY] Prompt injection attempt detected:', {
        pattern: pattern.toString(),
        ip: req.ip,
        path: req.path,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ error: 'Request blocked by security policy' });
    }
  }

  next();
}
```

---

## 3. AI Output Validator (Zod)

```typescript
import { z } from 'zod';

// Define your expected AI output schema
const AIResponseSchema = z.object({
  intent: z.string(),
  confidence: z.number().min(0).max(1),
  data: z.record(z.unknown()),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export async function safeAICall(
  callFn: () => Promise<unknown>,
  retries = 1
): Promise<AIResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const raw = await callFn();
    const result = AIResponseSchema.safeParse(raw);

    if (result.success) return result.data;

    console.warn(`[SECURITY] AI output validation failed (attempt ${attempt + 1}):`, result.error.flatten());

    if (attempt === retries) {
      throw new Error('AI output failed schema validation after retries — fallback required');
    }
  }
  throw new Error('Unreachable');
}
```

---

## 4. Inter-Skill Contract Types

```typescript
// Base contract for all inter-skill messages
export interface SkillContract<TInput, TOutput> {
  skillId: string;
  version: string;
  input: TInput;
  output?: TOutput;
  meta: {
    requestId: string;
    timestamp: string;
    callerSkillId: string;
  };
}

// Never pass raw prompts between skills — use structured intent
export interface SkillIntent {
  action: string;               // e.g. "generateComponent"
  params: Record<string, unknown>; // validated, typed params only
  constraints?: string[];       // security constraints from orchestrator
}

// Each skill must define its own contract types
export type CreateSkillContract<TInput, TOutput> = SkillContract<TInput, TOutput>;
```

---

## 5. React / Next.js — Safe Input Hook

```typescript
import { useState, useCallback } from 'react';

const MAX_INPUT_LENGTH = 2000;
const DANGEROUS_PATTERNS = [/<script/i, /javascript:/i, /on\w+\s*=/i];

interface SafeInputOptions {
  maxLength?: number;
  onBlocked?: (reason: string) => void;
}

export function useSafeInput(options: SafeInputOptions = {}) {
  const { maxLength = MAX_INPUT_LENGTH, onBlocked } = options;
  const [value, setValue] = useState('');
  const [blocked, setBlocked] = useState(false);

  const handleChange = useCallback((raw: string) => {
    // Enforce length
    const truncated = raw.slice(0, maxLength);

    // Check dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(truncated)) {
        setBlocked(true);
        onBlocked?.(`Blocked pattern: ${pattern}`);
        return;
      }
    }

    setBlocked(false);
    setValue(truncated);
  }, [maxLength, onBlocked]);

  return { value, blocked, handleChange };
}
```

---

## 6. Audit Logger

```typescript
type SecurityEvent =
  | 'INPUT_VALIDATION_FAILED'
  | 'PROMPT_INJECTION_DETECTED'
  | 'OUTPUT_VALIDATION_FAILED'
  | 'UNAUTHORIZED_ACCESS'
  | 'DATA_EXPOSURE_ATTEMPT';

interface AuditEntry {
  event: SecurityEvent;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  details: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export function auditLog(entry: Omit<AuditEntry, 'timestamp'>) {
  const record: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // In production: send to your SIEM / logging service
  console.warn('[AUDIT]', JSON.stringify(record));

  // Escalate critical events immediately
  if (entry.severity === 'CRITICAL') {
    // alertingService.send(record);
    console.error('[SECURITY ESCALATION]', record);
  }
}
```
