import { api } from '../shared/api.js';
import { handleForm } from '../shared/forms.js';

const form = document.getElementById('login-form');

handleForm(form, {
  busyLabel: 'Тексерілуде…',
  validate: () => (form.elements.email.value && form.elements.password.value ? '' : 'Электрондық пошта мен құпиясөзді жазыңыз.'),
  send: async (data) => {
    await api('/admin/login', { method: 'POST', body: Object.fromEntries(data) });
    location.href = '/admin/dashboard';
  },
});
