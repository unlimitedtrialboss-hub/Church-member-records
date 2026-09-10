const configuredApiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
const apiBaseUrl = import.meta.env.DEV ? '' : configuredApiBaseUrl;

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}