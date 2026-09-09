import { create } from "zustand";
import { connectionApi } from "@/lib/api";
import type { Connection, ConnectionCreate, SchemaMetadata } from "@/types/connection";

interface ConnectionState {
  connections: Connection[];
  schemas: Record<string, SchemaMetadata>;
  isLoading: boolean;

  fetchConnections: () => Promise<void>;
  createConnection: (data: ConnectionCreate) => Promise<Connection>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; message: string }>;
  syncConnection: (id: string) => Promise<void>;
  fetchSchema: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  schemas: {},
  isLoading: false,

  fetchConnections: async () => {
    set({ isLoading: true });
    try {
      const connections = await connectionApi.list();
      set({ connections });
    } finally {
      set({ isLoading: false });
    }
  },

  createConnection: async (data) => {
    const conn = await connectionApi.create(data);
    set({ connections: [...get().connections, conn] });
    return conn;
  },

  deleteConnection: async (id) => {
    await connectionApi.delete(id);
    set({ connections: get().connections.filter((c) => c.id !== id) });
  },

  testConnection: async (id) => {
    const result = await connectionApi.test(id);
    return { success: result.success, message: result.message };
  },

  syncConnection: async (id) => {
    const updated = await connectionApi.sync(id);
    set({
      connections: get().connections.map((c) => (c.id === id ? updated : c)),
    });
  },

  fetchSchema: async (id) => {
    const schema = await connectionApi.schema(id);
    set({ schemas: { ...get().schemas, [id]: schema } });
  },
}));
