const REFRESH_TOKEN_KEY = 'tender_refresh_token';

let accessToken: string | null = null;

export const tokenStore = {
  getAccessToken: () => accessToken,
  setAccessToken: (token: string | null) => {
    accessToken = token;
  },
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string | null) => {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },
  clear: () => {
    accessToken = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
