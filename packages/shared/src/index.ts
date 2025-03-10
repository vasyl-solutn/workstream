// Common types shared between frontend and backend
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
}

// Common utilities
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}
