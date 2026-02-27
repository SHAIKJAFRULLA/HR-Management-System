import { getAuthToken } from "../auth/tokenStorage.js";
import { httpJson } from "./http.js";

function resolveUrl(path) {
  const baseUrl = import.meta.env.VITE_BACKEND_URL;
  if (!baseUrl) throw new Error("VITE_BACKEND_URL is required");
  return new URL(path, baseUrl).toString();
}

function authToken(token) {
  return token || getAuthToken();
}

export const getHrDashboard = ({ token } = {}) =>
  httpJson("/api/hr/dashboard/", { token: authToken(token) });
export const verifyHrAccess = (username, password, { token } = {}) =>
  httpJson("/api/hr/access/verify/", {
    method: "POST",
    token: authToken(token),
    body: { username, password },
  });
export const getComplianceReport = (params = {}, { token } = {}) =>
  httpJson(
    `/api/hr/compliance-report/?${new URLSearchParams(params).toString()}`,
    { token: authToken(token) }
  );
export const getCtcAnalytics = ({ token } = {}) =>
  httpJson("/api/hr/ctc-analytics/", { token: authToken(token) });
export const getJoinersLeavers = (params = {}, { token } = {}) =>
  httpJson(
    `/api/hr/joiners-leavers/?${new URLSearchParams(params).toString()}`,
    { token: authToken(token) }
  );
export const getHeadcount = ({ token } = {}) =>
  httpJson("/api/hr/headcount/", { token: authToken(token) });
export const getAlerts = ({ token } = {}) =>
  httpJson("/api/hr/alerts/", { token: authToken(token) });
export const createAlert = (body, { token } = {}) =>
  httpJson("/api/hr/alerts/", { method: "POST", token: authToken(token), body });
export const getComplianceDashboard = ({ token } = {}) =>
  httpJson("/api/hr/compliance-dashboard/", { token: authToken(token) });
export const getDocuments = (empId, { token } = {}) =>
  httpJson(`/api/hr/documents/?${new URLSearchParams(empId ? { emp_id: empId } : {}).toString()}`, {
    token: authToken(token),
  });
export const verifyDocument = (docId, body, { token } = {}) =>
  httpJson(`/api/hr/documents/${docId}/verify/`, {
    method: "POST",
    token: authToken(token),
    body,
  });
export const getExitWorkflows = (empId, { token } = {}) =>
  httpJson(
    `/api/hr/exit-workflow/?${new URLSearchParams(empId ? { emp_id: empId } : {}).toString()}`,
    { token: authToken(token) }
  );
export const saveExitWorkflow = (body, { token } = {}) =>
  httpJson("/api/hr/exit-workflow/", { method: "POST", token: authToken(token), body });
export const getRoleCtcHistory = (empId, { token } = {}) =>
  httpJson(
    `/api/hr/role-ctc/?${new URLSearchParams(empId ? { emp_id: empId } : {}).toString()}`,
    { token: authToken(token) }
  );
export const addRoleCtcHistory = (body, { token } = {}) =>
  httpJson("/api/hr/role-ctc/", { method: "POST", token: authToken(token), body });
export const getOnboarding = (empId, { token } = {}) =>
  httpJson(
    `/api/hr/onboarding/?${new URLSearchParams(empId ? { emp_id: empId } : {}).toString()}`,
    { token: authToken(token) }
  );
export const bootstrapOnboarding = (body, { token } = {}) =>
  httpJson("/api/hr/onboarding/bootstrap/", { method: "POST", token: authToken(token), body });
export const saveOnboarding = (body, { token } = {}) =>
  httpJson("/api/hr/onboarding/", { method: "POST", token: authToken(token), body });

export async function uploadDocument(formData, { token } = {}) {
  const res = await fetch(resolveUrl("/api/hr/documents/"), {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken(token)}` },
    body: formData,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status})`);
  return payload;
}

export async function uploadOnboardingDocument(formData, { token } = {}) {
  const res = await fetch(resolveUrl("/api/hr/onboarding/"), {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken(token)}` },
    body: formData,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status})`);
  return payload;
}
