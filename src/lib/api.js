export const API_BASE = new URL("../../BackendLL/api", window.location.href).toString();

export async function apiRequest(path, data, method = "POST") {
  let response;
  try {
    response = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
      method,
      credentials: "include",
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw new Error("Can't reach RentEase accounts. Check that the backend is running.");
  }

  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`The account service returned an unexpected response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(result.message || "The request could not be completed.");
  }
  return result;
}

export async function apiUpload(path, formData) {
  let response;
  try {
    response = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
  } catch {
    throw new Error("Can't reach RentEase accounts. Check that the backend is running.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The account service returned an unexpected response.");
  }
  if (!response.ok) throw new Error(result.message || "The upload could not be completed.");
  return result;
}

export function propertyPhotoSource(listing) {
  const photo = String(listing?.photo_url || "");
  if (/^local:[a-f0-9]{32}\.jpg$/i.test(photo)) {
    const version = listing.updated_at ? `?v=${encodeURIComponent(listing.updated_at)}` : "";
    return `${API_BASE}/listings/${encodeURIComponent(listing.id)}/photo${version}`;
  }
  return photo;
}

export function request(path, data, method = "POST") {
  return apiRequest(`auth/${path}`, data, method);
}
