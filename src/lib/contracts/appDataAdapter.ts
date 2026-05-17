import type { Category, JqlFavorite, JqlResult, LocalTask, Tray } from "../types";

export type AppDataAdapter = {
  listProjects: () => Category[];
  listAreas: () => Category[];
  listTrays: () => Tray[];
  listActiveTrays: () => Tray[];
  getTrayById: (trayId: string | null) => Tray | null;
  getTaskById: (taskId: string | null) => LocalTask | null;
  listJqlFavorites: () => JqlFavorite[];
  getJqlFavoriteById: (favoriteId: string | undefined) => JqlFavorite | undefined;
  listJqlResults: () => JqlResult[];
};
