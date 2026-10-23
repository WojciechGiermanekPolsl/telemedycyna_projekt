const form = document.querySelector('#appointment-form');
const formTitle = document.querySelector('#form-title');
const message = document.querySelector('#appointment-message');
const logout = document.querySelector('#logout');
const appointmentId = new URLSearchParams(window.location.search).get('id');

let user;

try {
  user = JSON.parse(localStorage.getItem('telmedUser'));
} catch {
  localStorage.removeItem('telmedUser');
}

if (!user?.id) {
  window.location.replace('/login.html');
} else if (appointmentId) {
  formTitle.textContent = 'Edytuj termin';
  loadAppointment();
}

logout.addEventListener('click', () => {
  localStorage.removeItem('telmedUser');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = 'Zapisywanie...';
  message.className = 'form-message';

  const data = Object.fromEntries(new FormData(form));
  data.userId = user.id;
  data.recurring = form.elements.recurring.checked;

  const url = appointmentId ? `/api/appointments/${appointmentId}` : '/api/appointments';
  const method = appointmentId ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    message.textContent = result.message;
    message.className = 'form-message success';
    setTimeout(() => window.location.assign('/appointments.html'), 700);
  } catch (error) {
    message.textContent = error.message || 'Nie udało się zapisać terminu';
    message.className = 'form-message error';
  }
});

async function loadAppointment() {
  try {
    const response = await fetch(`/api/appointments/${appointmentId}?userId=${user.id}`);
    const appointment = await response.json();

    if (!response.ok) {
      throw new Error(appointment.error);
    }

    form.elements.eventType.value = appointment.eventType;
    form.elements.title.value = appointment.title;
    form.elements.startsAt.value = appointment.startsAt || '';
    form.elements.endsAt.value = appointment.endsAt || '';
    form.elements.doctorName.value = appointment.doctorName || '';
    form.elements.facility.value = appointment.facility || '';
    form.elements.description.value = appointment.description || '';
    form.elements.status.value = appointment.status;
    form.elements.recurring.checked = Boolean(appointment.frequency);
    form.elements.intervalValue.value = appointment.intervalValue || 1;
    form.elements.frequency.value = appointment.frequency || 'month';
    form.elements.recurrenceEndsAt.value = appointment.recurrenceEndsAt || '';
    form.elements.remindAt.value = appointment.remindAt || '';
  } catch (error) {
    message.textContent = error.message || 'Nie udało się pobrać terminu';
    message.className = 'form-message error';
  }
}
