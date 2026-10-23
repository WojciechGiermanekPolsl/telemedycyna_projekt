const notificationsBody = document.querySelector('#notifications-body');
const notificationsMessage = document.querySelector('#notifications-message');
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
  loadNotifications();
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

function addCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.append(cell);
  return cell;
}

function showEmpty(text) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.className = 'empty-state';
  cell.textContent = text;
  row.append(cell);
  notificationsBody.replaceChildren(row);
}

function statusName(status) {
  const statuses = {
    pending: 'Oczekujące',
    sent: 'Nowe',
    read: 'Przeczytane',
  };

  return statuses[status] ?? status;
}

function showNotifications(notifications) {
  if (!notifications.length) {
    showEmpty('Brak powiadomień.');
    return;
  }

  notificationsBody.replaceChildren();

  notifications.forEach((notification) => {
    const row = document.createElement('tr');
    addCell(row, formatDate(notification.remindAt));
    addCell(row, `${notification.title} — ${formatDate(notification.startsAt)}`);
    addCell(row, statusName(notification.status));

    const actions = document.createElement('td');
    if (notification.status !== 'read') {
      const button = document.createElement('button');
      button.className = 'btn btn-secondary btn-small';
      button.type = 'button';
      button.textContent = 'Oznacz jako przeczytane';
      button.addEventListener('click', () => markAsRead(notification.id));
      actions.append(button);
    } else {
      actions.textContent = '—';
    }

    row.append(actions);
    notificationsBody.append(row);
  });
}

async function loadNotifications() {
  try {
    const response = await fetch(`/api/notifications?userId=${user.id}`);
    const notifications = await response.json();

    if (!response.ok) {
      throw new Error(notifications.error);
    }

    showNotifications(notifications);
  } catch (error) {
    notificationsMessage.textContent = error.message || 'Nie udało się pobrać powiadomień';
    notificationsMessage.className = 'form-message error';
    showEmpty('Nie udało się pobrać powiadomień.');
  }
}

async function markAsRead(notificationId) {
  try {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    notificationsMessage.textContent = result.message;
    notificationsMessage.className = 'form-message success';
    loadNotifications();
  } catch (error) {
    notificationsMessage.textContent = error.message || 'Nie udało się zmienić powiadomienia';
    notificationsMessage.className = 'form-message error';
  }
}
