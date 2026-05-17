import { areas, jqlFavorites, jqlResults, projects, trays } from "../data";
import type { AppDataAdapter } from "../contracts";

export const mockAppDataAdapter: AppDataAdapter = {
  listProjects: () => projects,
  listAreas: () => areas,
  listTrays: () => trays,
  listActiveTrays: () => trays.filter((tray) => tray.state !== "Archived"),
  getTrayById: (trayId) => trays.find((tray) => tray.id === trayId) ?? null,
  getTaskById: (taskId) => trays.flatMap((tray) => tray.tasks).find((task) => task.id === taskId) ?? null,
  listJqlFavorites: () => jqlFavorites,
  getJqlFavoriteById: (favoriteId) => jqlFavorites.find((favorite) => favorite.id === favoriteId),
  listJqlResults: () => jqlResults
};
