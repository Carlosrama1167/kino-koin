let csrf = ''
export async function api(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers = { ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  if (options.method && options.method !== 'GET') {
    if (!csrf) csrf = (await fetch('/api/auth/csrf', { credentials: 'include' }).then(r => r.json())).csrf
    headers['X-CSRF-Token'] = csrf
  }
  const response = await fetch(path, { ...options, headers, credentials: 'include' })
  const data = await response.json().catch(() => ({}))
  if (data.csrf) csrf = data.csrf
  if (!response.ok) throw new Error(data.error || 'Permintaan gagal diproses.')
  return data
}
export async function login(identity, password) { return api('/api/auth/login', { method: 'POST', body: JSON.stringify({ identity, password }) }) }
export async function logout() { return api('/api/auth/logout', { method: 'POST' }) }
