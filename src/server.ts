import 'dotenv/config';

import express from 'express';
import mysql from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Brak zmiennej środowiskowej DATABASE_URL');
}

const pool = mysql.createPool(databaseUrl);
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.post('/auth/register', async (request, response) => {
  const { email, password, firstName, lastName } = request.body;

  if (!email || !password || !firstName || !lastName) {
    response.status(400).json({ error: 'Wypełnij wszystkie pola' });
    return;
  }

  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES (?, ?, ?, ?)`,
      [email, password, firstName, lastName],
    );

    response.status(201).json({ message: 'Konto zostało utworzone' });
  } catch (error) {
    console.error(error);
    response.status(400).json({ error: 'Nie udało się utworzyć konta' });
  }
});

app.post('/auth/login', async (request, response) => {
  const { email, password } = request.body;

  if (!email || !password) {
    response.status(400).json({ error: 'Podaj email i hasło' });
    return;
  }

  try {
    const [users] = await pool.execute<UserRow[]>(
      `SELECT id, email, first_name, last_name
       FROM users
       WHERE email = ? AND password_hash = ?
       LIMIT 1`,
      [email, password],
    );

    const user = users[0];
    if (!user) {
      response.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
      return;
    }

    response.json({
      message: `Zalogowano jako ${user.first_name} ${user.last_name}`,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Błąd połączenia z bazą danych' });
  }
});

async function databaseHealthcheck(
  _request: express.Request,
  response: express.Response,
): Promise<void> {
  try {
    await pool.query('SELECT 1');

    response.json({
      connection: 'test',
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    console.error('Błąd połączenia z MySQL:', error);

    response.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
}

app.get('/health', databaseHealthcheck);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Serwer działa na porcie ${port}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
