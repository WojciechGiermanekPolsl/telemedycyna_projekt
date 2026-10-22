const form = document.querySelector('#login-form');
const message = document.querySelector('#message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = 'Logowanie...';
  message.className = 'form-message';

  const data = Object.fromEntries(new FormData(form));
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();

  message.textContent = result.message ?? result.error;
  message.className = response.ok ? 'form-message success' : 'form-message error';
});
