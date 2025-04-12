export interface Item {
  id?: string;
  title: string;
  estimation: number;
  priority: number;
  createdAt: any; // Using 'any' for now to avoid firebase dependency
}

export interface CreateItemDto {
  title?: string;
  estimation?: number;
  priority?: number;
  previousId?: string | null;
  nextId?: string | null;
}
