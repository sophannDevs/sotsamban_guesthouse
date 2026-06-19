# Sot Samban GuestHouse Management

A full-stack guesthouse management system for daily front-desk operations. The app supports staff authentication, room inventory, guest records, bookings, payments, dashboard metrics, and admin user management.

## Tech Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Axios, React Hook Form, Zod
- Backend: NestJS, TypeScript, Prisma, JWT authentication
- Database: PostgreSQL
- Runtime: Docker Compose or local Node.js

## Features

- JWT login and protected dashboard routes
- Role-based access for `ADMIN` and `RECEPTIONIST`
- Admin-only user management
- Room list, create, edit, delete, and status filter
- Guest list, create, edit, delete, and search
- Booking list, create, detail view, check-in, check-out, cancel, and status filter
- Payment list, create, status update, and status filter
- Dashboard summary cards with recent bookings and payments
- Prisma seed data for default admin, rooms, and guests

## Folder Structure

```txt
guesthouse-management/
  backend/
    prisma/
      migrations/
      schema.prisma
      seed.ts
    src/
    Dockerfile
    .env.example
  frontend/
    src/
      app/
      components/
      lib/
    Dockerfile
    .env.example
  docker-compose.yml
  README.md
```

## Default Login

The seed creates an admin account:

```txt
Email: admin@example.com
Password: admin123
Role: ADMIN
```

Change this password before using the project outside local development.

## Docker Setup

Make sure Docker Desktop is running and ports `3000`, `3001`, and `5432` are free.

Start the full stack from the project root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- PostgreSQL: `localhost:5432`

The backend container waits for PostgreSQL, runs Prisma migrations, runs the seed, and then starts the API.

Stop services:

```bash
docker compose down
```

Reset the database volume:

```bash
docker compose down -v
```

## Backend Setup

From `backend/`:

```bash
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

Backend runs on:

```txt
http://localhost:3001
```

Backend environment example:

```env
DATABASE_URL="postgresql://guesthouse_user:guesthouse_password@localhost:5432/guesthouse_management?schema=public"
JWT_SECRET="guesthouse_dev_jwt_secret_change_me"
JWT_EXPIRES_IN="1d"
PORT="3001"
CORS_ORIGIN="http://localhost:3000"
```

For local development, start PostgreSQL first:

```bash
docker compose up -d postgres
```

Useful Prisma commands:

```bash
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run prisma:studio
```

## Frontend Setup

From `frontend/`:

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend runs on:

```txt
http://localhost:3000
```

Frontend environment example:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

If port `3000` is busy:

```bash
npm run dev -- --port 3002
```

## API Summary

All protected endpoints require:

```txt
Authorization: Bearer <accessToken>
```

Collection endpoints support standard pagination query parameters:

- `page` default `1`
- `limit` default `10`
- `search`
- `sortBy`
- `sortOrder` default `desc`

Paginated response shape:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Example:

```txt
GET /guests?page=1&limit=10&search=dara&sortBy=createdAt&sortOrder=desc
```

Common paginated list examples:

```txt
GET /rooms?page=1&limit=10&search=101&sortBy=roomNumber&sortOrder=asc
GET /guests?page=1&limit=10&search=dara&sortBy=fullName&sortOrder=asc
GET /bookings?page=1&limit=10&status=CONFIRMED&sortBy=checkInDate&sortOrder=asc
GET /payments?page=1&limit=10&status=PAID&sortBy=paidAt&sortOrder=desc
GET /users?page=1&limit=10&search=admin&sortBy=createdAt&sortOrder=desc
GET /notifications?page=1&limit=10&search=booking&sortBy=createdAt&sortOrder=desc
```

Auth:

- `POST /auth/register` creates a user. In an unseeded empty database, the first user is `ADMIN`; after running the seed, use the default admin account and manage roles from `/users`.
- `POST /auth/login` returns `accessToken` and user info.
- `GET /auth/me` returns the current user.

Dashboard:

- `GET /dashboard/summary`
- `GET /dashboard/recent-bookings`
- `GET /dashboard/recent-payments`

Notifications:

- `GET /notifications`
- `GET /notifications?all=true` admin only view of all notifications
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`
- `DELETE /notifications/:id`

Notifications are created for booking creation, guest check-in, guest
check-out, and paid payments. Maintenance notification helpers are available for
future maintenance request creation and resolution flows.

Settings:

- `GET /settings/profile` current user profile settings
- `PATCH /settings/profile` update current user `name`, `phone`, and `preferredLanguage`
- `PATCH /settings/security/change-password` update the current user's password
- `GET /settings/notifications` current user's notification preferences
- `PATCH /settings/notifications` update current user's notification preferences
- `GET /settings` admin and receptionist access
- `GET /settings/:key` admin and receptionist access
- `PATCH /settings/:key` admin only

Admins can update business and system preference settings. Receptionists can
view restricted settings but cannot update them. All authenticated users can
update their own profile, password, and notification preferences.

Allowed setting keys:

- `guesthouseName`
- `guesthouseAddress`
- `guesthousePhone`
- `guesthouseEmail`
- `currency`
- `timezone`
- `dateFormat`
- `language`
- `logoUrl`

Example:

```bash
curl -X PATCH http://localhost:3001/settings/guesthouseName \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"value":"Sot Samban GuestHouse"}'
```

Profile settings example:

```bash
curl -X PATCH http://localhost:3001/settings/profile \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin User","phone":"+855 12 345 678","preferredLanguage":"KM"}'
```

Password change example:

```bash
curl -X PATCH http://localhost:3001/settings/security/change-password \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"admin123","newPassword":"newpass123","confirmPassword":"newpass123"}'
```

Notification settings example:

```bash
curl -X PATCH http://localhost:3001/settings/notifications \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"bookingAlerts":true,"paymentAlerts":true,"maintenanceAlerts":false,"systemAlerts":true}'
```

System preference settings affect the dashboard, payments page, reports
preview, and invoice PDFs. Supported values are `USD` or `KHR` for currency,
`Asia/Phnom_Penh` for timezone, `YYYY-MM-DD` or `DD/MM/YYYY` for date format,
and `en` or `km` for default language.

Reports:

- `GET /reports/health`
- `GET /reports/revenue`
- `GET /reports/revenue?startDate=2026-01-01&endDate=2026-01-31`
- `GET /reports/bookings`
- `GET /reports/bookings?startDate=2026-01-01&endDate=2026-01-31&status=CONFIRMED&roomId=<roomId>&guestId=<guestId>&page=1&limit=10&sortBy=checkInDate&sortOrder=asc`
- `GET /reports/payments`
- `GET /reports/payments?startDate=2026-01-01&endDate=2026-01-31&paymentStatus=PAID&method=CASH&page=1&limit=10&sortBy=paidAt&sortOrder=desc`
- `GET /reports/guests`
- `GET /reports/guests?search=dara&startDate=2026-01-01&endDate=2026-01-31&page=1&limit=10&sortBy=fullName&sortOrder=asc`
- `GET /reports/occupancy`
- `GET /reports/:type/export?format=excel`
- `GET /reports/:type/export?format=pdf`

Supported export types:

- `revenue`
- `bookings`
- `payments`
- `guests`
- `occupancy`

Excel export examples:

```txt
GET /reports/revenue/export?format=excel&startDate=2026-01-01&endDate=2026-01-31
GET /reports/bookings/export?format=excel&status=CONFIRMED
GET /reports/payments/export?format=excel&paymentStatus=PAID&method=CASH
GET /reports/guests/export?format=excel&search=dara
GET /reports/occupancy/export?format=excel
```

Excel responses use:

```txt
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="{type}-report.xlsx"
```

PDF export examples:

```txt
GET /reports/revenue/export?format=pdf&startDate=2026-01-01&endDate=2026-01-31
GET /reports/bookings/export?format=pdf&status=CONFIRMED
GET /reports/payments/export?format=pdf&paymentStatus=PAID&method=CASH
GET /reports/guests/export?format=pdf&search=dara
GET /reports/occupancy/export?format=pdf
```

PDF responses use:

```txt
Content-Type: application/pdf
Content-Disposition: attachment; filename="{type}-report.pdf"
```

Invoices:

- `GET /invoices/booking/:bookingId/pdf`

Invoice PDF example:

```txt
GET /invoices/booking/<bookingId>/pdf
```

Invoice PDF responses use:

```txt
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice-{bookingId}.pdf"
```

Revenue report example:

```json
{
  "totalRevenue": 250,
  "paidRevenue": 180,
  "pendingRevenue": 70,
  "revenueByDate": [
    {
      "date": "2026-01-12",
      "revenue": 180
    }
  ],
  "revenueByPaymentMethod": [
    {
      "method": "CASH",
      "revenue": 180
    }
  ]
}
```

Booking report example:

```json
[
  {
    "bookingId": "cm123booking",
    "guestName": "Dara Sok",
    "roomNumber": "101",
    "checkInDate": "2026-01-12T00:00:00.000Z",
    "checkOutDate": "2026-01-14T00:00:00.000Z",
    "totalPrice": 80,
    "bookingStatus": "CONFIRMED"
  }
]
```

Payment report example:

```json
[
  {
    "paymentId": "cm123payment",
    "bookingId": "cm123booking",
    "guestName": "Dara Sok",
    "roomNumber": "101",
    "amount": 80,
    "method": "CASH",
    "status": "PAID",
    "paidAt": "2026-01-12T10:30:00.000Z"
  }
]
```

Guest report example:

```json
[
  {
    "guestId": "cm123guest",
    "fullName": "Dara Sok",
    "phone": "012345678",
    "email": "dara@example.com",
    "totalBookings": 2,
    "totalSpent": 160
  }
]
```

Occupancy report example:

```json
{
  "totalRooms": 12,
  "availableRooms": 7,
  "bookedRooms": 2,
  "occupiedRooms": 3,
  "maintenanceRooms": 0,
  "occupancyRate": 25
}
```

Rooms:

- `GET /rooms`
- `GET /rooms/availability?startDate=2026-01-01&endDate=2026-01-07`
- `GET /rooms/:id`
- `POST /rooms` admin only
- `POST /rooms/:id/image` admin only
- `PATCH /rooms/:id` admin only
- `DELETE /rooms/:id` admin only

Room image upload example:

```bash
curl -X POST http://localhost:3001/rooms/<roomId>/image \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@/path/to/room.webp"
```

Accepted image types are `jpg`, `jpeg`, `png`, and `webp`. The maximum file
size is 5 MB. Uploaded images are saved in `backend/uploads/rooms` and served
from `/uploads`, for example:

```json
{
  "imageUrl": "/uploads/rooms/1710000000000-example.webp"
}
```

Room availability example:

```json
[
  {
    "roomId": "seed-room-101",
    "roomNumber": "101",
    "roomType": "SINGLE",
    "pricePerNight": 25,
    "dates": [
      {
        "date": "2026-01-01",
        "status": "AVAILABLE"
      },
      {
        "date": "2026-01-02",
        "status": "BOOKED"
      }
    ]
  }
]
```

Guests:

- `GET /guests`
- `GET /guests?search=value`
- `GET /guests/:id`
- `POST /guests`
- `PATCH /guests/:id`
- `DELETE /guests/:id`

Bookings:

- `GET /bookings`
- `GET /bookings?status=PENDING`
- `GET /bookings/:id`
- `POST /bookings`
- `PATCH /bookings/:id/check-in`
- `PATCH /bookings/:id/check-out`
- `PATCH /bookings/:id/cancel`
- `PATCH /bookings/:id`
- `DELETE /bookings/:id`

Check-out flow: when a guest checks out, the booking status becomes `CHECKED_OUT`, the room status becomes `NEEDS_CLEANING` (not `AVAILABLE`), and a `HousekeepingTask` is automatically created in the same transaction. The room remains unavailable for new bookings until cleaning is completed and the room status is reset to `AVAILABLE`.

Booking date conflicts return `409 Conflict` with safe conflict details:

```json
{
  "message": "Room is already booked for the selected dates.",
  "code": "BOOKING_CONFLICT",
  "conflict": {
    "roomId": "room-id",
    "roomNumber": "101",
    "existingBookingId": "booking-id",
    "guestName": "John Doe",
    "checkInDate": "2026-06-10",
    "checkOutDate": "2026-06-15",
    "status": "CONFIRMED"
  }
}
```

Payments:

- `GET /payments`
- `GET /payments?status=PAID`
- `GET /payments/:id`
- `POST /payments`
- `PATCH /payments/:id`

Users:

- `GET /users` admin only
- `GET /users/:id` admin only
- `PATCH /users/:id` admin only
- `DELETE /users/:id` admin only

## Common Commands

Run checks:

```bash
cd backend && npm run build
cd frontend && npm run lint && npm run build
```

Find a port blocker:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Stop a process by PID:

```bash
kill <PID>
```
# sotsamban_guesthouse
