import { api } from './api.js'

// [WBS 5.1.1] Submit login credentials to the shared authentication API.
export function loginRequest(username, password) {
  return api('/auth/login', {
    method: 'POST',
    body: { username, password },
  })
}
