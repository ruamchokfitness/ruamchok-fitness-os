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

export interface Sale {
  id: string;
  date: any; // Firestore timestamp or Date
  salesperson: string;
  product: string;
  amount: number;
}

export interface SalesEmployee {
  id: string;
  name: string;
  position: string;
}

export interface Product {
  id: string;
  name: string;
  category: 'Membership' | 'Punch Card' | 'Personal Training' | 'Boxing Training' | 'Daily Pass' | 'Proshop' | 'Food & Beverage';
  defaultPrice: number;
}

export interface MonthlyTargets {
    target1?: number;
    target2?: number;
    target3?: number;
}

export interface SalespersonTargets {
    [salespersonName: string]: {
        target1?: number;
        target2?: number;
        target3?: number;
    }
}
