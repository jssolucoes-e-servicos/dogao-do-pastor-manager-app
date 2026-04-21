import { ICell, ICellMember, ICellNetwork, ISeller } from "./";

export interface IAuthUser {
  id: string;
  name: string;
  username: string;
  type: string;
  roles: string[];
  sellers: ISeller[];
  cells: ICell[];
  cellNetworks: ICellNetwork[];
  cellsMember: ICellMember[];
}