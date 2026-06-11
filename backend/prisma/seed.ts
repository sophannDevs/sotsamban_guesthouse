import 'dotenv/config';

import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured.');
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const rooms = [
  ['seed-room-101', '101', 'SINGLE', '25.00', 'AVAILABLE'],
  ['seed-room-102', '102', 'DOUBLE', '38.00', 'OCCUPIED'],
  ['seed-room-201', '201', 'TWIN', '42.00', 'AVAILABLE'],
  ['seed-room-202', '202', 'FAMILY', '65.00', 'BOOKED'],
  ['seed-room-301', '301', 'VIP', '95.00', 'MAINTENANCE'],
] as const;

const guests = [
  [
    'seed-guest-sok-dara',
    'Sok Dara',
    '+855 12 345 678',
    'sok.dara@example.com',
    'KH-A123456',
    'Siem Reap, Cambodia',
  ],
  [
    'seed-guest-chan-sophea',
    'Chan Sophea',
    '+855 15 222 333',
    'chan.sophea@example.com',
    'KH-B789012',
    'Phnom Penh, Cambodia',
  ],
  [
    'seed-guest-mao-vannak',
    'Mao Vannak',
    '+855 16 888 999',
    'mao.vannak@example.com',
    'KH-C345678',
    'Battambang, Cambodia',
  ],
] as const;

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const password = await bcrypt.hash('admin123', 10);

    await client.query(
      `
        INSERT INTO users (id, name, email, password, role, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          "preferredLanguage" = 'EN',
          "updatedAt" = NOW()
      `,
      ['seed-admin-user', 'Admin User', 'admin@example.com', password, 'ADMIN'],
    );

    for (const [id, roomNumber, type, pricePerNight, status] of rooms) {
      await client.query(
        `
          INSERT INTO rooms (
            id,
            "roomNumber",
            type,
            "pricePerNight",
            status,
            "createdAt",
            "updatedAt",
            "deletedAt"
          )
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NULL)
          ON CONFLICT ("roomNumber")
          DO UPDATE SET
            type = EXCLUDED.type,
            "pricePerNight" = EXCLUDED."pricePerNight",
            status = EXCLUDED.status,
            "deletedAt" = NULL,
            "updatedAt" = NOW()
        `,
        [id, roomNumber, type, pricePerNight, status],
      );
    }

    for (const [id, fullName, phone, email, idCardNumber, address] of guests) {
      await client.query(
        `
          INSERT INTO guests (
            id,
            "fullName",
            phone,
            email,
            "idCardNumber",
            address,
            "createdAt",
            "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (id)
          DO UPDATE SET
            "fullName" = EXCLUDED."fullName",
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            "idCardNumber" = EXCLUDED."idCardNumber",
            address = EXCLUDED.address,
            "updatedAt" = NOW()
        `,
        [id, fullName, phone, email, idCardNumber, address],
      );
    }

    await client.query('COMMIT');
    console.log('Seed complete: admin user, sample rooms, and sample guests.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
