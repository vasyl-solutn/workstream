export interface Item {
  id?: string;
  title: string;
  estimation: number;
  priority: number;
  createdAt: admin.firestore.Timestamp | null;
}

// Optional: Add type for creating a new item (without id and with optional fields)
export interface CreateItemDto {
  title?: string;
  estimation?: number;
  priority?: number;
}
