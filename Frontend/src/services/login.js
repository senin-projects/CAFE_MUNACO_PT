import { api } from './api.js'

export function loginRequest(username, password) {
  return api('/auth/login', {
    method: 'POST',
    body: { username, password },
  })
}
