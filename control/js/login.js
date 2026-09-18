const form = document.querySelector('#login-form');
const errorBox = document.querySelector('#login-error');

fetch('/api/auth/me', { credentials: 'same-origin' })
  .then((response) => { if (response.ok) window.location.replace('/admin/'); })
  .catch(() => {});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Проверяем…';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось войти');
    window.location.replace('/admin/');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    button.disabled = false;
    button.textContent = 'Войти';
  }
});
