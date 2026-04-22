export interface ICellMember {
  id: string;
  cellId: string;
  cell?: {
    id: string;
    name: string;
    sellerId?: string;
    seller?: {
      id: string;
      name: string;
      tag: string;
    };
  };
}