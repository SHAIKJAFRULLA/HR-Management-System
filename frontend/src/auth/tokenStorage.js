const TOKEN_STORAGE_KEY = 'auth_token'
const PROFILE_STORAGE_KEY = 'auth_profile_type'

export function getAuthToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function getAuthProfileType() {
  return localStorage.getItem(PROFILE_STORAGE_KEY) || 'user'
}

export function setAuthProfileType(profileType) {
  localStorage.setItem(PROFILE_STORAGE_KEY, profileType)
}

export function clearAuthProfileType() {
  localStorage.removeItem(PROFILE_STORAGE_KEY)
}
