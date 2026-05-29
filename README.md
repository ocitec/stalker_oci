# STALKER v1 — Cash Control System

> Cashflow intelligence platform for reducing DSO and enforcing payment discipline among corporate clients.

---

## Architecture Overview

```
stalker-v1/
├── apps/
│   ├── api/          # NestJS backend (Node.js 20)
│   └── web/          # Next.js 15 frontend
├── services/
│   ├── alert-engine/ # Pre-due alert cron (built into API)
│   └── analytics-ai/ # AI analytics (built into API)
├── docker-compose.yml
└── README.md
```

### Tech Stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | Next.js 15, React 19, TypeScript, TailwindCSS |
| State       | Zustand + TanStack Query v5                   |
| Backend     | NestJS 10, Node.js 20                         |
| Database    | PostgreSQL 16 + Prisma ORM                    |
| Cache/Queue | Redis 7 + BullMQ                              |
| Auth        | JWT + Refresh Tokens + RBAC                   |
| Containers  | Docker + Docker Compose                       |

---

## Quick Start (Local Development)

### Prerequisites
- Node.js ≥ 20
- Docker + Docker Compose
- npm ≥ 10

### 1. Clone & Install

```bash
git clone https://github.com/yourorg/stalker-v1.git
cd stalker-v1
```

### 2. Start Infrastructure

```bash
docker-compose up postgres redis -d
```

### 3. Setup API

```bash
cd apps/api
cp .env.example .env          # edit values as needed
npm install
npx prisma migrate dev --name init
npx prisma db seed             # creates demo org, users, clients, invoices
npm run dev
# API: http://localhost:3001
# Docs: http://localhost:3001/api/docs
```

### 4. Setup Frontend

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
# Web: http://localhost:3000
```

### 5. Login

| Role    | Email                          | Password      |
|---------|-------------------------------|---------------|
| CFO     | amaka.obi@zenithcorp.ng       | Password123!  |
| Finance | chidi.nwosu@zenithcorp.ng     | Password123!  |

---

## Docker (Full Stack)

```bash
docker-compose up --build
```

Access:
- Frontend:   http://localhost:3000
- API:        http://localhost:3001
- API Docs:   http://localhost:3001/api/docs

---

## API Endpoints

### Auth
| Method | Endpoint               | Description                  |
|--------|------------------------|------------------------------|
| POST   | /api/v1/auth/register  | Register org + admin user    |
| POST   | /api/v1/auth/login     | Login → access + refresh JWT |
| POST   | /api/v1/auth/refresh   | Rotate refresh token         |
| POST   | /api/v1/auth/logout    | Invalidate refresh token     |
| GET    | /api/v1/auth/me        | Get current user             |

### Clients
| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| POST   | /api/v1/clients            | Create client            |
| GET    | /api/v1/clients            | List all (paginated)     |
| GET    | /api/v1/clients/:id        | Get single client        |
| PUT    | /api/v1/clients/:id        | Update client            |
| PATCH  | /api/v1/clients/:id/block  | Block client (CFO only)  |
| GET    | /api/v1/clients/pdi-ranking| PDI league table         |

### Invoices
| Method | Endpoint                       | Description              |
|--------|--------------------------------|--------------------------|
| POST   | /api/v1/invoices               | Create invoice           |
| GET    | /api/v1/invoices               | List all (paginated)     |
| GET    | /api/v1/invoices/overdue       | All overdue invoices     |
| GET    | /api/v1/invoices/aging         | Aging bucket breakdown   |
| GET    | /api/v1/invoices/dso           | Current DSO calculation  |
| PATCH  | /api/v1/invoices/:id/mark-paid | Mark paid → triggers PDI |

### Follow-ups
| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| POST   | /api/v1/followups          | Log a follow-up          |
| GET    | /api/v1/followups          | List follow-ups          |
| GET    | /api/v1/followups/compliance| Compliance metrics       |

### Analytics
| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| GET    | /api/v1/analytics/pdi-ranking   | Full PDI ranking         |
| GET    | /api/v1/analytics/sector        | Sector analysis          |
| GET    | /api/v1/analytics/predictive-risk| Late payment probability |
| GET    | /api/v1/analytics/insights      | AI behavioral insights   |
| GET    | /api/v1/analytics/cfo-report    | Weekly CFO summary       |

### Dashboard
| Method | Endpoint            | Description              |
|--------|---------------------|--------------------------|
| GET    | /api/v1/dashboard   | Executive KPI dashboard  |

### SLA
| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| GET    | /api/v1/sla/violations     | Violation log            |
| GET    | /api/v1/sla/top-violators  | Top offenders            |
| GET    | /api/v1/sla/summary        | Summary stats            |

---

## Core Engines

### ENGINE 1 — Pre-Due Alert Engine
- Cron: runs daily at 07:00 AM
- Triggers alerts at 7d, 3d, 1d before due date
- Queues email notifications via BullMQ
- Dashboard alerts created in real-time

### ENGINE 2 — Payment Discipline Index (PDI)
- Formula: `(on-time payments / total invoices) × 100`
- Recalculated on every invoice payment
- Weekly full recalculation via cron (Monday 08:00)
- Auto-blocks clients with PDI < 30

### ENGINE 3 — Follow-Up Clock
- Runs inside daily cron
- Flags overdue invoices with no follow-up in 5+ days
- Creates `FOLLOW_UP_STALE` dashboard alerts

---

## RBAC Roles

| Role    | Permissions                                    |
|---------|------------------------------------------------|
| ADMIN   | Full access including user management           |
| CFO     | All + block/unblock clients, view all reports  |
| FINANCE | Create invoices, log follow-ups, view dashboard|
| SALES   | Read-only client and invoice views             |

---

## Security

- JWT access tokens (15 min expiry)
- Refresh token rotation (7 day expiry)
- bcrypt password hashing (12 rounds)
- Helmet security headers
- API rate limiting (20 req/s, 100 req/10s, 500 req/min)
- Input validation with class-validator
- SQL injection protection via Prisma ORM
- CORS restricted to configured frontend URL
- Audit log model for all sensitive operations

---

## Performance

- PostgreSQL with strategic indexes on all filter/sort columns
- Redis caching layer (configurable TTL)
- BullMQ async job queues for email, PDI recalculation
- Server-side pagination (all list endpoints)
- TanStack Query stale-while-revalidate on frontend
- Prisma connection pooling

---

## Scaling to 10,000 Concurrent Requests

1. **Horizontal API scaling**: Run multiple API containers behind a load balancer (nginx/AWS ALB)
2. **Read replicas**: Add `DATABASE_REPLICA_URL` for read queries
3. **Redis cluster**: Enable Redis cluster mode for queue distribution
4. **CDN**: Serve Next.js static assets via CloudFront/Cloudflare
5. **Message queue**: Migrate BullMQ to Kafka for extreme throughput

---

## Cloud Deployment (AWS)

```
Route53 → CloudFront → ALB
                          ├── ECS Fargate (api × N)
                          └── ECS Fargate (web × N)
                               ├── RDS PostgreSQL (Multi-AZ)
                               └── ElastiCache Redis
```

---

## Connecting a Real AI/LLM

Replace `getAiInsights()` in `analytics.service.ts`:

```typescript
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a CFO-level financial analyst...' },
    { role: 'user',   content: `Analyse this receivables data: ${JSON.stringify(clientData)}` },
  ],
});
```
