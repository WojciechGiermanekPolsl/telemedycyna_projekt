const monthInput = document.querySelector('#calendar-month');
const calendarBody = document.querySelector('#calendar-body');
const calendarMessage = document.querySelector('#calendar-message');
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
  const today = new Date();
  monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  loadCalendar();
}

logout.addEventListener('click', () => {
  localStorage.removeItem('telmedUser');
});

monthInput.addEventListener('change', loadCalendar);

function nextMonth(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}

function renderCalendar(appointments) {
  const [year, month] = monthInput.value.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const numberOfCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const appointmentsByDay = new Map();

  appointments.forEach((appointment) => {
    const day = Number(appointment.startsAt.slice(8, 10));
    const items = appointmentsByDay.get(day) || [];
    items.push(appointment);
    appointmentsByDay.set(day, items);
  });

  calendarBody.replaceChildren();

  for (let cellNumber = 0; cellNumber < numberOfCells; cellNumber += 7) {
    const row = document.createElement('tr');

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const cell = document.createElement('td');
      const day = cellNumber + weekday - firstWeekday + 1;

      if (day >= 1 && day <= daysInMonth) {
        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = day;
        cell.append(dayNumber);

        (appointmentsByDay.get(day) || []).forEach((appointment) => {
          const link = document.createElement('a');
          link.className = 'calendar-event';
          link.href = `appointment-form.html?id=${appointment.id}`;
          link.textContent = `${appointment.startsAt.slice(11, 16)} ${appointment.title}`;
          cell.append(link);
        });
      }

      row.append(cell);
    }

    calendarBody.append(row);
  }
}

async function loadCalendar() {
  const from = `${monthInput.value}-01T00:00`;
  const to = `${nextMonth(monthInput.value)}-01T00:00`;

  try {
    const response = await fetch(
      `/api/appointments?userId=${user.id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    const appointments = await response.json();

    if (!response.ok) {
      throw new Error(appointments.error);
    }

    calendarMessage.textContent = '';
    renderCalendar(appointments);
  } catch (error) {
    calendarMessage.textContent = error.message || 'Nie udało się pobrać kalendarza';
    calendarMessage.className = 'form-message error';
  }
}
