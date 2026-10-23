const welcome = document.querySelector('#welcome');
const dashboardMessage = document.querySelector('#dashboard-message');
const appointmentsList = document.querySelector('#appointments-list');
const notificationsList = document.querySelector('#notifications-list');
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
  welcome.textContent = `Zalogowany użytkownik: ${user.firstName} ${user.lastName}`;
  loadDashboard();
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

function showEmpty(container, text) {
  const paragraph = document.createElement('p');
  paragraph.className = 'empty-state';
  paragraph.textContent = text;
  container.replaceChildren(paragraph);
}

function showAppointments(appointments) {
  if (!appointments.length) {
    showEmpty(appointmentsList, 'Brak zaplanowanych terminów.');
    return;
  }

  const list = document.createElement('ul');
  list.className = 'simple-list';

  appointments.forEach((appointment) => {
    const item = document.createElement('li');
    const type = appointment.eventType === 'examination' ? 'badanie' : 'wizyta';
    item.textContent = `${formatDate(appointment.startsAt)} — ${appointment.title} (${type})`;
    list.append(item);
  });

  appointmentsList.replaceChildren(list);
}

function showNotifications(notifications) {
  if (!notifications.length) {
    showEmpty(notificationsList, 'Brak nowych powiadomień.');
    return;
  }

  const list = document.createElement('ul');
  list.className = 'simple-list';

  notifications.forEach((notification) => {
    const item = document.createElement('li');
    item.textContent = `${formatDate(notification.remindAt)} — ${notification.title}`;
    list.append(item);
  });

  notificationsList.replaceChildren(list);
}

async function loadDashboard() {
  try {
    const response = await fetch(`/api/dashboard?userId=${user.id}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    showAppointments(result.appointments);
    showNotifications(result.notifications);
  } catch (error) {
    dashboardMessage.textContent = error.message || 'Nie udało się pobrać danych panelu';
    dashboardMessage.className = 'form-message error';
    showEmpty(appointmentsList, 'Nie udało się pobrać terminów.');
    showEmpty(notificationsList, 'Nie udało się pobrać powiadomień.');
  }
}
