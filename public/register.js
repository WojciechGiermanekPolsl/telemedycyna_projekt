const form = document.querySelector('#register-form');
const message = document.querySelector('#message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form));

  if (data.password !== data.confirmPassword) {
    message.textContent = 'Podane hasła nie są takie same';
    message.className = 'form-message error';
    return;
  }

  const response = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();

  message.textContent = result.message ?? result.error;
  message.className = response.ok ? 'form-message success' : 'form-message error';

  if (response.ok) {
    setTimeout(() => window.location.assign('/login.html'), 1000);
  }
});
