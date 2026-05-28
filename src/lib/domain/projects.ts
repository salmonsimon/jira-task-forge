export const PINNED_PROJECT_NAME = "Transversal";

export function orderProjectNames(projects: string[]): string[] {
  const pinnedProjects: string[] = [];
  const otherProjects: string[] = [];

  for (const project of projects) {
    if (project === PINNED_PROJECT_NAME) {
      pinnedProjects.push(project);
    } else {
      otherProjects.push(project);
    }
  }

  return pinnedProjects.length ? [...pinnedProjects, ...otherProjects] : [...projects];
}
