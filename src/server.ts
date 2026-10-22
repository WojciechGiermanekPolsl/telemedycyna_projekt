import 'dotenv/config';

import express from 'express';
import mysql from 'mysql2/promise';

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Brak zmiennej środowiskowej DATABASE_URL');
}

const pool = mysql.createPool(databaseUrl);
const app = express();


app.get('/', async (_request, response) => {
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
});

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
