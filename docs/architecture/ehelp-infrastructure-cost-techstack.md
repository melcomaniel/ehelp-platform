# EHELP — Infrastructure, Costing & Tech Stack

**Document type:** Architecture & cost baseline  
**Audience:** Product, engineering, and stakeholders reviewing *Impact / Value / Cost-Benefit* and *Implementation & Scalability*  
**Status:** Baseline proposal (directional AWS list pricing; not a vendor quote)  
**Last updated:** 2026-07-22  

**Related:**
- `docs/design/workflow-engine-iterations.md` — workflow product model  
- `docs/design/workflow-engine-step-palette.md` — step palette  
- Interactive companion: Cursor canvas `ehelp-infra-architecture.canvas.tsx`

---

## 1. Purpose & scope

This document defines the **target runtime architecture**, **technology stack**, and **monthly/daily cost bands** for EHELP (web + mobile) at production scale.

It answers:

1. **Impact, value & cost-benefit** — what the platform changes, illustrative value, and infra run-rate.  
2. **Implementation & scalability** — how we build and scale (planes, replicas, phases).  

### 1.1 Scale assumptions

| Parameter | Value |
|-----------|--------|
| Monthly active users (MAU) | **100,000** |
| Peak concurrent transactions / sessions | **5,000 – 10,000** |
| Client channels | **Web + Mobile** sharing one Core API |
| Deploy topology | **Two services** (FE image + Core image), horizontally scaled |
| Cache (Redis) | **Not required** in baseline |
| Payment provider fees | **Out of scope** of AWS infra run-rate |

> **Concurrent ≠ requests/second.** Concurrent means open sessions / in-flight workflows (apply, upload, review). RPS is lower; **Postgres connections**, uploads, and payout webhooks dominate capacity planning.

### 1.2 What “2 containers” means

| Phrase | Meaning |
|--------|---------|
| **2 containers / 2 services** | Two **images**: Front-End (Next.js) and Core (API). Mobile and web both call **Core**. |
| **FE ×4 / Core ×16** | **Replica counts** — identical tasks behind a load balancer. Not “4 CPUs” or “16 different servers.” |
| **Task size** | e.g. Core **2 vCPU / 8 GB** *each* replica |

---

## 2. Impact, value & cost-benefit

### 2.1 Impact

| Area | Without EHELP (typical) | With this architecture |
|------|-------------------------|-------------------------|
| Citizen intake | Fragmented web / mobile / paper | One Core API; web + mobile; version-pinned flows |
| Process control | Regional ad-hoc steps | National template; satellite reshape; locked **Approval → Payout** |
| Integrity | Weak audit; double-pay risk | Append-only events; DB unique disbursement keys; separation of duties |
| Operations | Opaque queues | SQS payout path; CloudWatch; WAF-protected edge |

### 2.2 Illustrative annual value (proxies)

Replace with DSWD unit costs when available. Mid proxy assumes ~**240,000** assisted cases/year touching the platform.

| Lever | Proxy | ≈ Annual |
|-------|--------|----------|
| Staff time saved | 0.35 h/case × $8/h | ~$672k |
| Integrity / leakage avoided | $2.50/case | ~$600k |
| Citizen time | 0.5 h × $3 opportunity | ~$360k |
| **Combined (illustrative)** | | **~$1.6M / year** |

Even at half these proxies, value still dominates the High infra band (~$45k/year).

### 2.3 Cost bands (infra run-rate)

**Pricing basis:** AWS Fargate On-Demand, Linux/x86, us-east-1 list rates (~Jul 2026):  
`$0.04048 / vCPU-hour` + `$0.004445 / GB-hour` × **730 hours/month**.  
APAC regions often **+10–30%**. Managed Postgres/Redis figures are **directional multi-AZ bands**, not Reserved Instance quotes.

#### Monthly — Mid (~5k concurrent) vs High (~10k concurrent)

| Line item | Plane | Mid / mo | High / mo |
|-----------|--------|----------|-----------|
| FE replicas | Compute | 3 × 1 vCPU / 2 GB ≈ **$108** | 4 × 1 vCPU / 2 GB ≈ **$144** |
| Core replicas | Compute | 8 × 2 vCPU / 4 GB ≈ **$577** | 16 × 2 vCPU / 8 GB ≈ **$1,361** |
| PostgreSQL multi-AZ + storage/backup | **Database** | ≈ **$650** | ≈ **$1,400** |
| CloudFront + WAF + ALB + NAT | **Security / edge** | ≈ **$280** | ≈ **$450** |
| CloudWatch logs/metrics/alarms | Ops | ≈ **$180** | ≈ **$320** |
| Auth extras (beyond base plan buffer) | Auth | ≈ **$40** | ≈ **$60** |
| Redis / ElastiCache | Cache | **$0** (skipped) | **$0** (skipped) |
| eGovPay / bank / e-wallet **fees** | Payment gateway | **Excluded** | **Excluded** |
| **Total infra** | | **≈ $1,835 / mo** | **≈ $3,735 / mo** |
| **Per day (÷ 30)** | | **≈ $61 / day** | **≈ $125 / day** |
| **Per year (× 12)** | | **≈ $22k / yr** | **≈ $45k / yr** |

#### Included vs excluded

| Included in ~$3,735 High | Not included |
|--------------------------|--------------|
| FE + Core Fargate | eGovPay / bank / e-wallet **per-tx or %** |
| PostgreSQL multi-AZ | Provider monthly/setup fees |
| Security plane (WAF, CloudFront, ALB, NAT) | SMS OTP per-message fees |
| SQS + payout **worker capacity** (on Core/consumers) | Third-party KYC / face liveness |
| CloudWatch + auth extras buffer | Redis (optional later ≈ +$520/mo) |
| | Pen-test / SOC retainers |

**Payment gateway:** infra pays for *ability to call the gateway safely at scale*. **Gateway fees scale with pesos disbursed** and belong under **program finance**, not AWS concurrent sizing.

### 2.4 Cost-benefit summary

| Scenario | Annual infra | Illustrative value | Benefit / cost |
|----------|--------------|--------------------|----------------|
| Mid (~5k concurrent) | ≈ $22k | ≈ $1.6M | ~70×+ |
| High (~10k concurrent) | ≈ $45k | ≈ $1.6M | ~35×+ |

Binding constraint: **reliability** (connection pooling, WAF, async idempotent payout), not raw AWS spend.

---

## 3. Implementation & scalability

### 3.1 Architecture (planes)

Security, database, and payment gateway are **first-class planes** — not side notes on the Core box.

```
┌──────────────────────── CLIENTS ─────────────────────────┐
│  Web (Next.js 16)              Mobile (Flutter)          │
└──────────────┬──────────────────────────┬────────────────┘
               ▼                          ▼
╔══════════════════ SECURITY PLANE ════════════════════════╗
║  CloudFront (TLS/cache) → AWS WAF (rate limit) → ALB     ║
╚══════════════┬──────────────────────────┬════════════════╝
               ▼ /                    /api▼
        ┌─ FE ×4 ─┐              ┌─ Core ×16 ──────────┐
        │ Next.js │─────────────▶│ Shared API          │
        └─────────┘              │ JWT validation      │
                                 └─┬────────┬────────┬─┘
                                   │        │        │
               ┌───────────────────┘        │        └──────────┐
               ▼                            ▼                   ▼
┌── AUTH ──────────────┐   ╔══ DATABASE PLANE ═══╗   ┌─ FILES ─┐
│ Supabase Auth (JWT)  │   ║ PostgreSQL multi-AZ ║   │ S3      │
│ OTP / password       │   ║ + connection pooler ║   │ signed  │
└──────────────────────┘   ║ apps · RBAC · audit ║   │ URLs    │
                           ║ payout unique keys  ║   └─────────┘
                           ╚═════════▲═══════════╝
                                     │ status
╔════════════════ PAYMENT GATEWAY PLANE ═══════════════════╗
║ Core → SQS → Payout worker → eGovPay / bank / e-wallet   ║
║              (external fees NOT in infra run-rate)       ║
║ Webhooks → Core → Postgres disbursement status           ║
╚══════════════════════════════════════════════════════════╝
         CloudWatch (logs / metrics / alarms) over all planes
```

### 3.2 High band capacity specification

| Component | Spec (High ~10k concurrent) | Role |
|-----------|----------------------------|------|
| FE service | **4** tasks × **1 vCPU / 2 GB** | Next.js UI; static preferred on CloudFront |
| Core service | **16** tasks × **2 vCPU / 8 GB** | Stateless API for web + mobile |
| PostgreSQL | Multi-AZ managed + storage/backups | System of record |
| Pooler | PgBouncer or Supavisor | **Mandatory** without Redis |
| Edge / security | CloudFront + AWS WAF + ALB + NAT | TLS, rate limits, routing |
| Auth | Supabase Auth → JWT | No sticky sessions |
| Objects | S3 + signed URLs | IDs / evidence |
| Async payout | SQS + worker (+ optional dedicated tasks) | Idempotent via DB unique keys |
| Observability | CloudWatch | 5xx, saturation, pool wait, SQS depth |

**Mid (~5k concurrent):** FE ×3 · Core ×8 (2 vCPU / 4 GB) · smaller Postgres/edge bands (see §2.3).

### 3.3 Design rules (no-Redis baseline)

1. **Stateless Core** — any replica can serve any request; JWT only.  
2. **Pool Postgres hard** — connection storms are the primary failure mode at concurrent peaks.  
3. **Payout = SQS + unique DB key** — never fire-and-forget double-pay.  
4. **WAF before FE/Core** — auth and apply endpoints rate-limited at the edge.  
5. **Add Redis later** only for distributed locks / hot cache beyond CDN (~+$520/mo) — optional.

### 3.4 Scalability controls

| Strategy | Mechanism |
|----------|-----------|
| Horizontal scale | Increase FE/Core task count behind ALB; autoscale on CPU / RPS / latency |
| Edge offload | CloudFront for static assets and downloadable artifacts |
| Async decoupling | SQS for disbursement and notifications so approval path stays responsive |
| Data protection | Pooler; indexed status/queue queries; read replica only if read-heavy later |
| Payment scale | Provider capacity + more workers; idempotency always in Postgres |

### 3.5 Implementation phases

| Phase | Deliverables | Scale posture |
|-------|--------------|---------------|
| **1 — Foundation** | Auth (Supabase) · Postgres schema · FE+Core single-task deploy · WAF baseline | Dev/staging; prove JWT, RBAC, audit events |
| **2 — Product** | Workflow templates · regional reshape · locked Approval→Payout · admin console | Mid replicas (FE×3, Core×8); pooler on |
| **3 — Payout** | SQS worker · eGovPay sandbox→prod · idempotent disbursement keys · webhooks | Async path load-tested |
| **4 — Scale** | Autoscale policies · load test 5–10k concurrent · alarms/runbooks | High replicas (FE×4, Core×16); Postgres sized |

---

## 4. Technology stack

### 4.1 By plane

| Plane | Technology | Notes |
|-------|------------|--------|
| **Clients** | Next.js 16, React 19, Tailwind; Flutter, Riverpod, go_router, `supabase_flutter` | Both channels → one Core |
| **Security** | CloudFront, AWS WAF, ALB (TLS), Secrets Manager / SSM, IAM | First-class plane; in edge cost band |
| **Compute — FE** | ECS on Fargate, Next.js | Replica count scales independently |
| **Compute — Core** | ECS on Fargate, stateless HTTP/JSON API | Shared by web + mobile |
| **Auth** | Supabase Auth (email OTP / password), JWT | Core validates JWT; roles in Postgres |
| **Database** | PostgreSQL (RDS or Supabase), migrations, RLS where applicable | Explicit ~$1.4k High line |
| **Pooler** | PgBouncer / Supavisor | Required at concurrent scale |
| **Files** | Amazon S3, signed URLs | Evidence / IDs |
| **Payment plumbing** | Amazon SQS, payout worker | Our infra |
| **Payment gateway** | **eGovPay** (target) / bank / e-wallet APIs | **External**; fees out of infra |
| **Ops** | CloudWatch (+ optional X-Ray) | Alarms on error, saturation, queue depth |
| **Baseline out** | Redis / ElastiCache | Optional later |

### 4.2 Application domain (product)

Aligned with existing design docs:

- Workflow **templates** (DSWD) → regional **programs** (satellite reshape of prefix)  
- Locked tail: **single Approval → Payout**  
- Version pin for in-flight applications; upgrade = replace + deprecate prior version  
- Roles: DSWD admin authors templates; satellite publishes regional programs; approver / disburser execute steps (SoD)

### 4.3 Current repo alignment

| Area | Today in repo | Target runtime |
|------|---------------|----------------|
| Web | `web/client` — Next.js + Supabase | Same stack on FE service + Core API split as backend hardens |
| Mobile | `mobile` — Flutter + Supabase | Calls shared Core |
| Admin | `/admin` — live RBAC/templates + workflow UI under `/admin/workflows` | Stays on admin console |
| Data | Supabase Postgres | Same engine; size up / pool for concurrent |

---

## 5. Decision log

| Decision | Choice |
|----------|--------|
| Client backends | **One shared Core** for web + mobile |
| Auth sessions | **JWT (Supabase)** — no sticky server sessions |
| Security | **CloudFront + WAF + ALB** as explicit plane |
| Database | **Postgres multi-AZ + pooler** — explicit cost line |
| Redis | **Skip** in baseline |
| Payment | **SQS worker + eGovPay (external)**; gateway fees outside infra |
| High budget | **≈ $3,735 / mo** · **≈ $125 / day** · **≈ $45k / yr** |
| Replica mental model | **×N = task count**; **2 containers = 2 services** |

---

## 6. Document control

| Item | Detail |
|------|--------|
| Cost figures | Directional; refresh against AWS Pricing Calculator / Finance before procurement |
| Owners | Engineering (runtime) · Product (value proxies) · Finance (gateway fee budget) |
| Next review triggers | Region choice (APAC uplift) · eGovPay fee schedule · load-test results · Redis go/no-go |
