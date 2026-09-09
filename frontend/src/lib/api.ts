import axios from "axios";
import type { Connection, ConnectionCreate, ConnectionTest } from "@/types/connection";
import type { Dashboard, DashboardCreate, DashboardDetail, DashboardUpdate, LayoutItem } from "@/types/dashboard";
import type { PromptRequest, PromptResponse, QueryRequest, QueryResult } from "@/types/query";
import type { Widget, WidgetCreate, WidgetUpdate } from "@/types/widget";

// ── Axios instance ──────────────────────────────────────────

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url?.includes("/auth/")) {
      localStorage.removeItem("token");
      window.location.href = "/auth";
    }
    return Promise.reject(err);
  },
);

// ── Auth ─────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export const authApi = {
  register: (data: { email: string; name: string; password: string }) =>
    api.post<TokenResponse>("/auth/register", data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<TokenResponse>("/auth/login", data).then((r) => r.data),
  devLogin: () => api.post<TokenResponse>("/auth/dev-login").then((r) => r.data),
  me: () => api.get<AuthUser>("/auth/me").then((r) => r.data),
  updateMe: (data: { name?: string; email?: string }) =>
    api.put<AuthUser>("/auth/me", data).then((r) => r.data),
};

// ── Dashboards ───────────────────────────────────────────────

export const dashboardApi = {
  list: () => api.get<Dashboard[]>("/dashboards").then((r) => r.data),
  get: (id: string) => api.get<DashboardDetail>(`/dashboards/${id}`).then((r) => r.data),
  create: (data: DashboardCreate) => api.post<Dashboard>("/dashboards", data).then((r) => r.data),
  update: (id: string, data: DashboardUpdate) =>
    api.put<Dashboard>(`/dashboards/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/dashboards/${id}`),
  updateLayout: (id: string, widgets: LayoutItem[]) =>
    api.put(`/dashboards/${id}/layout`, { widgets }).then((r) => r.data),
  duplicate: (id: string) => api.post<Dashboard>(`/dashboards/${id}/duplicate`).then((r) => r.data),
  share: (id: string) =>
    api.post<{ is_public: boolean; share_url: string | null }>(`/dashboards/${id}/share`).then((r) => r.data),
};

// ── Widgets ──────────────────────────────────────────────────

export const widgetApi = {
  get: (id: string) => api.get<Widget>(`/widgets/${id}`).then((r) => r.data),
  create: (data: WidgetCreate) => api.post<Widget>("/widgets", data).then((r) => r.data),
  update: (id: string, data: WidgetUpdate) =>
    api.put<Widget>(`/widgets/${id}`, data).then((r) => r.data),
  duplicate: (id: string) => api.post<Widget>(`/widgets/${id}/duplicate`).then((r) => r.data),
  delete: (id: string) => api.delete(`/widgets/${id}`),
  refresh: (id: string) => api.post<Widget>(`/widgets/${id}/refresh`).then((r) => r.data),
};

// ── Connections ──────────────────────────────────────────────

export const connectionApi = {
  list: () => api.get<Connection[]>("/connections").then((r) => r.data),
  create: (data: ConnectionCreate) =>
    api.post<Connection>("/connections", data).then((r) => r.data),
  delete: (id: string) => api.delete(`/connections/${id}`),
  test: (id: string) =>
    api.post<ConnectionTest>(`/connections/${id}/test`).then((r) => r.data),
  sync: (id: string) => api.post<Connection>(`/connections/${id}/sync`).then((r) => r.data),
  schema: (id: string) => api.get(`/connections/${id}/schema`).then((r) => r.data),
};

// ── Prompts ──────────────────────────────────────────────────

export const promptApi = {
  send: (data: PromptRequest) =>
    api.post<PromptResponse>("/prompt", data).then((r) => r.data),
  modifyWidget: (widgetId: string, modificationPrompt: string) =>
    api
      .post<PromptResponse>("/prompt/modify", {
        widget_id: widgetId,
        modification_prompt: modificationPrompt,
      })
      .then((r) => r.data),
  suggest: (connectionId?: string) =>
    api
      .post<{ suggestions: string[] }>("/prompt/suggest", {
        connection_id: connectionId,
      })
      .then((r) => r.data.suggestions),
};

// ── Queries ──────────────────────────────────────────────────

export const queryApi = {
  execute: (data: QueryRequest) =>
    api.post<QueryResult>("/query/execute", data).then((r) => r.data),
  history: () => api.get("/query/history").then((r) => r.data),
};

export default api;
