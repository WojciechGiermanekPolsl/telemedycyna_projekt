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

interface AppointmentOwnerRow extends RowDataPacket {
  recurrence_rule_id: number | null;
}

const appointmentSelect = `
  SELECT
    a.id,
    a.event_type AS eventType,
    a.title,
    a.description,
    a.doctor_name AS doctorName,
    a.facility,
    DATE_FORMAT(a.starts_at, '%Y-%m-%dT%H:%i') AS startsAt,
    DATE_FORMAT(a.ends_at, '%Y-%m-%dT%H:%i') AS endsAt,
    a.status,
    r.frequency,
    r.interval_value AS intervalValue,
    DATE_FORMAT(r.ends_at, '%Y-%m-%dT%H:%i') AS recurrenceEndsAt,
    DATE_FORMAT(n.remind_at, '%Y-%m-%dT%H:%i') AS remindAt
  FROM appointments a
  LEFT JOIN recurrence_rules r ON r.id = a.recurrence_rule_id
  LEFT JOIN (
    SELECT appointment_id, MIN(remind_at) AS remind_at
    FROM notifications
    WHERE status != 'cancelled'
    GROUP BY appointment_id
  ) n ON n.appointment_id = a.id
`;

function sqlDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  const date = value.replace('T', ' ');
  return date.length === 16 ? `${date}:00` : date;
}

function validUserId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validAppointmentType(value: unknown): value is 'control_visit' | 'examination' {
  return value === 'control_visit' || value === 'examination';
}

function validStatus(value: unknown): value is 'scheduled' | 'completed' | 'cancelled' {
  return value === 'scheduled' || value === 'completed' || value === 'cancelled';
}

function validFrequency(value: unknown): value is 'day' | 'week' | 'month' | 'year' {
  return value === 'day' || value === 'week' || value === 'month' || value === 'year';
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
  const email = String(request.body.email || '').trim().toLowerCase();
  const password = String(request.body.password || '');
  const firstName = String(request.body.firstName || '').trim();
  const lastName = String(request.body.lastName || '').trim();

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
  const email = String(request.body.email || '').trim().toLowerCase();
  const password = String(request.body.password || '');

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
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Błąd połączenia z bazą danych' });
  }
});

app.get('/api/dashboard', async (request, response) => {
  const userId = validUserId(request.query.userId);

  if (!userId) {
    response.status(400).json({ error: 'Brak identyfikatora użytkownika' });
    return;
  }

  try {
    await pool.execute(
      `UPDATE notifications n
       JOIN appointments a ON a.id = n.appointment_id
       SET n.status = 'sent', n.sent_at = CURRENT_TIMESTAMP
       WHERE a.user_id = ? AND n.status = 'pending' AND n.remind_at <= CURRENT_TIMESTAMP`,
      [userId],
    );

    const [appointments] = await pool.execute<RowDataPacket[]>(
      `${appointmentSelect}
       WHERE a.user_id = ? AND a.status = 'scheduled' AND a.starts_at >= CURRENT_TIMESTAMP
       ORDER BY a.starts_at
       LIMIT 5`,
      [userId],
    );
    const [notifications] = await pool.execute<RowDataPacket[]>(
      `SELECT
         n.id,
         n.status,
         DATE_FORMAT(n.remind_at, '%Y-%m-%dT%H:%i') AS remindAt,
         a.title
       FROM notifications n
       JOIN appointments a ON a.id = n.appointment_id
       WHERE a.user_id = ? AND n.status IN ('pending', 'sent')
       ORDER BY n.remind_at
       LIMIT 5`,
      [userId],
    );

    response.json({ appointments, notifications });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Nie udało się pobrać danych panelu' });
  }
});

app.get('/api/appointments', async (request, response) => {
  const userId = validUserId(request.query.userId);

  if (!userId) {
    response.status(400).json({ error: 'Brak identyfikatora użytkownika' });
    return;
  }

  const conditions = ['a.user_id = ?'];
  const parameters: Array<string | number> = [userId];

  if (validAppointmentType(request.query.type)) {
    conditions.push('a.event_type = ?');
    parameters.push(request.query.type);
  }
  if (validStatus(request.query.status)) {
    conditions.push('a.status = ?');
    parameters.push(request.query.status);
  }
  if (typeof request.query.from === 'string') {
    conditions.push('a.starts_at >= ?');
    parameters.push(sqlDate(request.query.from) || request.query.from);
  }
  if (typeof request.query.to === 'string') {
    conditions.push('a.starts_at < ?');
    parameters.push(sqlDate(request.query.to) || request.query.to);
  }

  try {
    const [appointments] = await pool.execute<RowDataPacket[]>(
      `${appointmentSelect}
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.starts_at`,
      parameters,
    );

    response.json(appointments);
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Nie udało się pobrać terminów' });
  }
});

app.get('/api/appointments/:id', async (request, response) => {
  const userId = validUserId(request.query.userId);
  const appointmentId = Number(request.params.id);

  if (!userId || !Number.isInteger(appointmentId)) {
    response.status(400).json({ error: 'Nieprawidłowe dane' });
    return;
  }

  try {
    const [appointments] = await pool.execute<RowDataPacket[]>(
      `${appointmentSelect}
       WHERE a.id = ? AND a.user_id = ?
       LIMIT 1`,
      [appointmentId, userId],
    );

    if (!appointments[0]) {
      response.status(404).json({ error: 'Nie znaleziono terminu' });
      return;
    }

    response.json(appointments[0]);
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Nie udało się pobrać terminu' });
  }
});

app.post('/api/appointments', async (request, response) => {
  const userId = validUserId(request.body.userId);
  const startsAt = sqlDate(request.body.startsAt);
  const endsAt = sqlDate(request.body.endsAt);

  if (!userId || !validAppointmentType(request.body.eventType) || !request.body.title || !startsAt) {
    response.status(400).json({ error: 'Typ, nazwa i data terminu są wymagane' });
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    let recurrenceRuleId: number | null = null;

    if (request.body.recurring) {
      const frequency = validFrequency(request.body.frequency) ? request.body.frequency : 'month';
      const intervalValue = Math.max(1, Number(request.body.intervalValue) || 1);
      const [rule] = await connection.execute<ResultSetHeader>(
        `INSERT INTO recurrence_rules (user_id, frequency, interval_value, ends_at)
         VALUES (?, ?, ?, ?)`,
        [userId, frequency, intervalValue, sqlDate(request.body.recurrenceEndsAt)],
      );
      recurrenceRuleId = rule.insertId;
    }

    const [appointment] = await connection.execute<ResultSetHeader>(
      `INSERT INTO appointments
         (user_id, recurrence_rule_id, event_type, title, description, doctor_name, facility, starts_at, ends_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        recurrenceRuleId,
        request.body.eventType,
        String(request.body.title).trim(),
        request.body.description || null,
        request.body.doctorName || null,
        request.body.facility || null,
        startsAt,
        endsAt,
        validStatus(request.body.status) ? request.body.status : 'scheduled',
      ],
    );

    const remindAt = sqlDate(request.body.remindAt);
    if (remindAt) {
      await connection.execute(
        'INSERT INTO notifications (appointment_id, remind_at) VALUES (?, ?)',
        [appointment.insertId, remindAt],
      );
    }

    await connection.commit();
    response.status(201).json({ id: appointment.insertId, message: 'Termin został dodany' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    response.status(500).json({ error: 'Nie udało się dodać terminu' });
  } finally {
    connection.release();
  }
});

app.put('/api/appointments/:id', async (request, response) => {
  const appointmentId = Number(request.params.id);
  const userId = validUserId(request.body.userId);
  const startsAt = sqlDate(request.body.startsAt);
  const endsAt = sqlDate(request.body.endsAt);

  if (!userId || !validAppointmentType(request.body.eventType) || !request.body.title || !startsAt) {
    response.status(400).json({ error: 'Nieprawidłowe dane terminu' });
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<AppointmentOwnerRow[]>(
      'SELECT recurrence_rule_id FROM appointments WHERE id = ? AND user_id = ? LIMIT 1',
      [appointmentId, userId],
    );

    if (!rows[0]) {
      await connection.rollback();
      response.status(404).json({ error: 'Nie znaleziono terminu' });
      return;
    }

    const previousRuleId = rows[0].recurrence_rule_id;
    let recurrenceRuleId = previousRuleId;

    if (request.body.recurring) {
      const frequency = validFrequency(request.body.frequency) ? request.body.frequency : 'month';
      const intervalValue = Math.max(1, Number(request.body.intervalValue) || 1);
      const recurrenceEndsAt = sqlDate(request.body.recurrenceEndsAt);

      if (previousRuleId) {
        await connection.execute(
          `UPDATE recurrence_rules
           SET frequency = ?, interval_value = ?, ends_at = ?
           WHERE id = ? AND user_id = ?`,
          [frequency, intervalValue, recurrenceEndsAt, previousRuleId, userId],
        );
      } else {
        const [rule] = await connection.execute<ResultSetHeader>(
          `INSERT INTO recurrence_rules (user_id, frequency, interval_value, ends_at)
           VALUES (?, ?, ?, ?)`,
          [userId, frequency, intervalValue, recurrenceEndsAt],
        );
        recurrenceRuleId = rule.insertId;
      }
    } else {
      recurrenceRuleId = null;
    }

    await connection.execute(
      `UPDATE appointments
       SET recurrence_rule_id = ?, event_type = ?, title = ?, description = ?,
           doctor_name = ?, facility = ?, starts_at = ?, ends_at = ?, status = ?
       WHERE id = ? AND user_id = ?`,
      [
        recurrenceRuleId,
        request.body.eventType,
        String(request.body.title).trim(),
        request.body.description || null,
        request.body.doctorName || null,
        request.body.facility || null,
        startsAt,
        endsAt,
        validStatus(request.body.status) ? request.body.status : 'scheduled',
        appointmentId,
        userId,
      ],
    );

    if (!request.body.recurring && previousRuleId) {
      await connection.execute('DELETE FROM recurrence_rules WHERE id = ?', [previousRuleId]);
    }

    await connection.execute('DELETE FROM notifications WHERE appointment_id = ?', [appointmentId]);
    const remindAt = sqlDate(request.body.remindAt);
    if (remindAt) {
      await connection.execute(
        'INSERT INTO notifications (appointment_id, remind_at) VALUES (?, ?)',
        [appointmentId, remindAt],
      );
    }

    await connection.commit();
    response.json({ message: 'Termin został zapisany' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    response.status(500).json({ error: 'Nie udało się zapisać terminu' });
  } finally {
    connection.release();
  }
});

app.delete('/api/appointments/:id', async (request, response) => {
  const appointmentId = Number(request.params.id);
  const userId = validUserId(request.query.userId);

  if (!userId || !Number.isInteger(appointmentId)) {
    response.status(400).json({ error: 'Nieprawidłowe dane' });
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<AppointmentOwnerRow[]>(
      'SELECT recurrence_rule_id FROM appointments WHERE id = ? AND user_id = ? LIMIT 1',
      [appointmentId, userId],
    );

    if (!rows[0]) {
      await connection.rollback();
      response.status(404).json({ error: 'Nie znaleziono terminu' });
      return;
    }

    await connection.execute('DELETE FROM appointments WHERE id = ? AND user_id = ?', [appointmentId, userId]);
    if (rows[0].recurrence_rule_id) {
      await connection.execute('DELETE FROM recurrence_rules WHERE id = ?', [rows[0].recurrence_rule_id]);
    }

    await connection.commit();
    response.json({ message: 'Termin został usunięty' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    response.status(500).json({ error: 'Nie udało się usunąć terminu' });
  } finally {
    connection.release();
  }
});

app.get('/api/notifications', async (request, response) => {
  const userId = validUserId(request.query.userId);

  if (!userId) {
    response.status(400).json({ error: 'Brak identyfikatora użytkownika' });
    return;
  }

  try {
    await pool.execute(
      `UPDATE notifications n
       JOIN appointments a ON a.id = n.appointment_id
       SET n.status = 'sent', n.sent_at = CURRENT_TIMESTAMP
       WHERE a.user_id = ? AND n.status = 'pending' AND n.remind_at <= CURRENT_TIMESTAMP`,
      [userId],
    );
    const [notifications] = await pool.execute<RowDataPacket[]>(
      `SELECT
         n.id,
         n.status,
         DATE_FORMAT(n.remind_at, '%Y-%m-%dT%H:%i') AS remindAt,
         a.title,
         DATE_FORMAT(a.starts_at, '%Y-%m-%dT%H:%i') AS startsAt
       FROM notifications n
       JOIN appointments a ON a.id = n.appointment_id
       WHERE a.user_id = ? AND n.status != 'cancelled'
       ORDER BY n.remind_at`,
      [userId],
    );

    response.json(notifications);
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Nie udało się pobrać powiadomień' });
  }
});

app.patch('/api/notifications/:id/read', async (request, response) => {
  const notificationId = Number(request.params.id);
  const userId = validUserId(request.body.userId);

  if (!userId || !Number.isInteger(notificationId)) {
    response.status(400).json({ error: 'Nieprawidłowe dane' });
    return;
  }

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE notifications n
       JOIN appointments a ON a.id = n.appointment_id
       SET n.status = 'read', n.read_at = CURRENT_TIMESTAMP
       WHERE n.id = ? AND a.user_id = ?`,
      [notificationId, userId],
    );

    if (!result.affectedRows) {
      response.status(404).json({ error: 'Nie znaleziono powiadomienia' });
      return;
    }

    response.json({ message: 'Powiadomienie oznaczono jako przeczytane' });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Nie udało się zmienić powiadomienia' });
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
