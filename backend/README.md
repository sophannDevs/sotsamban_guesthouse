<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Finance API

The Finance API provides a cross-business financial summary. Requires `x-business-id` header. Both ADMIN and RECEPTIONIST can access.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/finance/summary` | JWT + `x-business-id` | Financial summary for a single business |
| GET | `/finance/summary/all-businesses` | JWT | Combined summary across all accessible businesses |

### Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `rangePreset` | `this_month` | Preset period: `today`, `this_week`, `this_month`, `last_month`, `last_3_months`, `this_year`, `custom` |
| `startDate` | — | ISO date, required when `rangePreset=custom` |
| `endDate` | — | ISO date, required when `rangePreset=custom` |

### Response

```json
{
  "success": true,
  "message": "Finance summary retrieved successfully.",
  "data": {
    "period": "This Month",
    "startDate": "2026-06-01",
    "endDate": "2026-06-30",
    "totalRevenue": 2500.00,
    "totalExpense": 900.00,
    "netProfit": 1600.00
  }
}
```

### Revenue Source by Business Type

| Business Type | Revenue Source |
|--------------|----------------|
| `GUESTHOUSE` | PAID booking payments (filtered by `paidAt`) |
| `STORE` | COMPLETED sales (filtered by `createdAt`) |

Expenses always come from the `Expense` table scoped to the business, filtered by `expenseDate`.

### Example

```bash
# Single-business summary
GET /finance/summary?rangePreset=this_month
Authorization: Bearer <token>
x-business-id: <businessId>

GET /finance/summary?rangePreset=custom&startDate=2026-01-01&endDate=2026-03-31
Authorization: Bearer <token>
x-business-id: <businessId>
```

### GET /finance/summary/all-businesses

Returns a combined summary across every business the authenticated user has access to.
No `x-business-id` header is required.

**Access rules:**
- `UserRole.ADMIN` — sees all businesses in the system.
- `UserRole.RECEPTIONIST` — sees only businesses where the user holds `BusinessRole.OWNER` or `BusinessRole.ADMIN`.
- Businesses where the user is only a `STAFF` member are excluded.

**Response:**

```json
{
  "success": true,
  "message": "All-businesses finance summary retrieved successfully.",
  "data": {
    "period": "This Month",
    "startDate": "2026-06-01",
    "endDate": "2026-06-30",
    "totalRevenue": 5000.00,
    "totalExpense": 1800.00,
    "netProfit": 3200.00,
    "businesses": [
      {
        "businessId": "4c82d6f1-b51c-4b84-97a0-bbb1cb6cea0e",
        "businessName": "Sot Samban Guest House",
        "businessType": "GUESTHOUSE",
        "revenue": 3000.00,
        "expense": 1000.00,
        "netProfit": 2000.00
      },
      {
        "businessId": "69b11f82-c977-4f8d-bc2e-776d9d65c3c5",
        "businessName": "Snack Store",
        "businessType": "STORE",
        "revenue": 2000.00,
        "expense": 800.00,
        "netProfit": 1200.00
      }
    ]
  }
}
```

**Example requests:**

```bash
# This month (default)
GET /finance/summary/all-businesses
Authorization: Bearer <token>

# Custom date range
GET /finance/summary/all-businesses?rangePreset=custom&startDate=2026-01-01&endDate=2026-03-31
Authorization: Bearer <token>

# Preset: last 3 months
GET /finance/summary/all-businesses?rangePreset=last_3_months
Authorization: Bearer <token>
```

**Revenue source per business type:**

| Business Type | Revenue Source | Scoped by businessId |
|--------------|----------------|----------------------|
| `GUESTHOUSE` | PAID booking payments (`paidAt`) | No (schema limitation — one guesthouse per system) |
| `STORE` | COMPLETED sales (`createdAt`) | Yes |

Expenses always come from the `Expense` table, scoped to each business by `businessId` and filtered by `expenseDate`.

## Expenses API

The Expenses API manages business expenses for any business type (GUESTHOUSE or STORE). Requires `x-business-id` header on all requests. ADMIN can create, update, and delete; RECEPTIONIST can only view.

### Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/expenses` | ADMIN | Create a new expense |
| GET | `/expenses` | ADMIN, RECEPTIONIST | List expenses with filters and pagination |
| GET | `/expenses/:id` | ADMIN, RECEPTIONIST | Get a single expense |
| PATCH | `/expenses/:id` | ADMIN | Update an expense |
| DELETE | `/expenses/:id` | ADMIN | Delete an expense |

### Query Parameters (GET /expenses)

- `page`, `limit`, `sortBy`, `sortOrder`, `search` — standard pagination/search (search matches title)
- `startDate` — filter expenses on or after this date (ISO 8601)
- `endDate` — filter expenses on or before this date (ISO 8601, inclusive end of day)
- `category` — filter by `ExpenseCategory` enum value
- `paymentMethod` — filter by `ExpensePaymentMethod` enum value

### Enums

**ExpenseCategory**: `RENT`, `ELECTRICITY`, `WATER`, `INTERNET`, `SALARY`, `MAINTENANCE`, `SUPPLIES`, `FOOD`, `OTHER`

**ExpensePaymentMethod**: `CASH`, `CARD`, `QR`, `BANK_TRANSFER`

### Example

```bash
# Create expense
POST /expenses
x-business-id: <businessId>
{ "title": "Monthly Rent", "category": "RENT", "amount": 500, "expenseDate": "2026-06-15", "paymentMethod": "BANK_TRANSFER" }

# List with filters
GET /expenses?category=RENT&startDate=2026-06-01&endDate=2026-06-30
x-business-id: <businessId>
```

## Reports API

The reports API supports date range presets via the `rangePreset` query parameter. This allows generating reports for specific time periods aligned with the system's configured timezone.

### Supported rangePreset Values
- `today`
- `yesterday`
- `this_week`
- `last_week`
- `this_month` (default)
- `last_month`
- `last_3_months`
- `last_6_months`
- `this_year`
- `custom` (requires `startDate` and `endDate` query parameters)

### Examples
- `GET /reports/revenue?rangePreset=this_month`
- `GET /reports/bookings?rangePreset=last_3_months`
- `GET /reports/payments/export?format=excel&rangePreset=this_week`
