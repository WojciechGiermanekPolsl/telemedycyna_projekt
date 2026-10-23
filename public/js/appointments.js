const appointmentsBody = document.querySelector('#appointments-body');
const appointmentsMessage = document.querySelector('#appointments-message');
const logout = document.querySelector('#logout');

let user;

try {
  user = JSON.parse(localStorage.getItem('telmedUser'));
} catch {
  localStorage.removeItem('telmedUser');
}

if (!user?.id) {
  window.location.replace('/login.html');
} else {
  loadAppointments();
}

logout.addEventListener('click', () => {
  localStorage.removeItem('telmedUser');
});

function formatDate(value) {
  return new Date(value).toLocaleString('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function typeName(type) {
  return type === 'examination' ? 'Badanie' : 'Wizyta kontrolna';
}

function statusName(status) {
  const statuses = {
    scheduled: 'Zaplanowany',
    completed: 'Zakończony',
    cancelled: 'Odwołany',
  };

  return statuses[status] ?? status;
}

function showEmpty(text) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 5;
  cell.className = 'empty-state';
  cell.textContent = text;
  row.append(cell);
  appointmentsBody.replaceChildren(row);
}

function addCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.append(cell);
  return cell;
}

function showAppointments(appointments) {
  if (!appointments.length) {
    showEmpty('Brak zapisanych terminów.');
    return;
  }

  appointmentsBody.replaceChildren();

  appointments.forEach((appointment) => {
    const row = document.createElement('tr');
    addCell(row, formatDate(appointment.startsAt));
    addCell(row, typeName(appointment.eventType));
    addCell(row, appointment.title);
    addCell(row, statusName(appointment.status));

    const actions = document.createElement('td');
    const edit = document.createElement('a');
    edit.className = 'btn btn-secondary btn-small';
    edit.href = `appointment-form.html?id=${appointment.id}`;
    edit.textContent = 'Edytuj';

    const remove = document.createElement('button');
    remove.className = 'btn btn-secondary btn-small';
    remove.type = 'button';
    remove.textContent = 'Usuń';
    remove.addEventListener('click', () => deleteAppointment(appointment.id));

    actions.append(edit, remove);
    row.append(actions);
    appointmentsBody.append(row);
  });
}

async function loadAppointments() {
  try {
    const response = await fetch(`/api/appointments?userId=${user.id}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    showAppointments(result);
  } catch (error) {
    appointmentsMessage.textContent = error.message || 'Nie udało się pobrać terminów';
    appointmentsMessage.className = 'form-message error';
    showEmpty('Nie udało się pobrać terminów.');
  }
}

async function deleteAppointment(appointmentId) {
  if (!window.confirm('Czy na pewno usunąć ten termin?')) {
    return;
  }

  try {
    const response = await fetch(`/api/appointments/${appointmentId}?userId=${user.id}`, {
      method: 'DELETE',
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    appointmentsMessage.textContent = result.message;
    appointmentsMessage.className = 'form-message success';
    loadAppointments();
  } catch (error) {
    appointmentsMessage.textContent = error.message || 'Nie udało się usunąć terminu';
    appointmentsMessage.className = 'form-message error';
  }
}
