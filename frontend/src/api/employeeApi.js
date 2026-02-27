import { httpJson } from "./http.js";

export const getEmployees = ({ token } = {}) => {
  return httpJson("/employees/", { method: "GET", token });
};

export const createEmployee = (data, { token } = {}) => {
  return httpJson("/employees/", { method: "POST", token, body: data });
};

export const updateEmployee = (id, data, { token } = {}) => {
  return httpJson(`/employees/${id}/`, { method: "PUT", token, body: data });
};

export const deactivateEmployee = (id, endDate, { token } = {}) => {
  return httpJson(`/employees/${id}/exit/`, {
    method: "POST",
    token,
    body: { end_date: endDate },
  });
};

export const getEmployeeProfile = (id, { token } = {}) => {
  return httpJson(`/employees/${id}/profile/`, { method: "GET", token });
};

export const getEmployeeBankAccount = (id, { token } = {}) => {
  return httpJson(`/employees/${id}/bank-account/`, { method: "GET", token });
};

export const upsertEmployeeBankAccount = (id, data, { token } = {}) => {
  return httpJson(`/employees/${id}/bank-account/`, { method: "PUT", token, body: data });
};
