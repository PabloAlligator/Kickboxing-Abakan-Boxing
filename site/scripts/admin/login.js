const form = document.querySelector('#login-form');
const errorBox = document.querySelector('#login-error');
const submitButton = form.querySelector('button[type="submit"]');
const submitText = document.querySelector('[data-login-submit-text]');
const loader = document.querySelector('[data-login-loader]');
const passwordInput = document.querySelector('#admin-password');
const passwordToggle = document.querySelector('[data-password-toggle]');

fetch('/api/admin/auth/me', { credentials: 'same-origin' })
  .then((response) => {
    if (response.ok) window.location.replace('/admin/dashboard');
  })
  .catch(() => undefined);

passwordToggle?.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  passwordToggle.textContent = show ? 'Скрыть' : 'Показать';
  passwordToggle.setAttribute('aria-pressed', String(show));
  passwordToggle.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  submitButton.disabled = true;
  submitText.textContent = 'Проверяем';
  loader.hidden = false;

  try {
    const response = await fetch('/api/admin/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось войти');
    window.location.replace('/admin/dashboard');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    submitButton.disabled = false;
    submitText.textContent = 'Войти';
    loader.hidden = true;
  }
});
