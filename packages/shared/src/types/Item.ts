export interface Item {
  id?: string;
  title: string;
  estimation: number;
  estimationFormat: 'points' | 'time';
  priority: number;
  createdAt: any; // Using 'any' for now to avoid firebase dependency
  startedAt?: string | null; // Timestamp when timer was started
  parentId?: string | null; // Reference to parent item
}

export interface CreateItemDto {
  title: string;
  estimation?: number;
  estimationFormat?: 'points' | 'time';
  priority?: number;
  previousId?: string | null;
  nextId?: string | null;
  startedAt?: string | null; // Add startedAt to DTO
  parentId?: string | null; // Reference to parent item
}
