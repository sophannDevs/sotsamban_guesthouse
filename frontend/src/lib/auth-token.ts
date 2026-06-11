const ACCESS_TOKEN_KEY = "guesthouse_access_token"

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function removeAccessToken() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}
