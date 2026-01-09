export const API_BASE = import.meta.env.VITE_API_URL;

function withAccessKey(path, headers) {
  // Mentor routes
  if (path.startsWith("/api/mentor")) {
    const k = sessionStorage.getItem("mentorKey");
    if (k) headers["x-access-key"] = k;
  }
  // Task endpoints: attach mentor key if present (write endpoints require it)
  if (path.startsWith("/api/tasks")) {
    const k = sessionStorage.getItem("mentorKey");
    if (k) headers["x-access-key"] = k;
  }

  // Admin routes (/manage)
  if (path.startsWith("/api/admin")) {
    const k = sessionStorage.getItem("managerKey");
    if (k) headers["x-access-key"] = k;
  }
  return headers;
}

export async function api(path, options = {}) {
  const headers = withAccessKey(path, {
    "Content-Type": "application/json",
    ...(options.headers || {})
  });

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
