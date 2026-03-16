export type Employee = {
  id: string;
  name: string;
};

export type Leave = {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  type: string;
  days: number;
};

export type Quota = {
  employeeId: string;
  vacation: number;
  holiday: number;
  birthday: number;
  holidayPermissions: string[];
};

export type Policy = {
  key: string;
  value: string;
};

export type VacationTier = {
  id:string;
  years: string;
  days: string;
};

export type PublicHoliday = {
  id: string;
  name: string;
  date: string;
};

export type CustomHoliday = {
  id: string;
  name: string;
};

export interface MaintenanceCategory {
  id: string;
  name: string;
}

export interface MaintenanceReport {
  id: string;
  date: string;
  responsible: string;
  category: string;
  maintenanceItem: string;
  notes: string;
  completed: boolean;
  timestamp: any; // Firestore timestamp
}
