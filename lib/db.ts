import Dexie, { Table } from "dexie";

export interface Stats {
  id?: number;
  xp: number;
  streak: number;
  lastCompleted: string;
}

class SmartDB extends Dexie {
  stats!: Table<Stats>;

  constructor() {
    super("SmartCompanionDB");
    this.version(1).stores({
      stats: "++id"
    });
  }
}

export const db = new SmartDB();