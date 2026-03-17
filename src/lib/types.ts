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

// PT Tracker Types
export interface PTClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive';
}

export interface PTTrainer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  commission_plan: 'PLAN_A' | 'PLAN_B';
  status: 'active' | 'inactive';
}

export interface PTPackage {
  id: string;
  client_id: string;
  package_name: string;
  hours_purchased: number;
  price_paid: number;
  price_per_hour: number;
  purchase_date: string;
  expiry_date: string;
  hours_used: number;
  hours_remaining: number;
  status: 'active' | 'expired' | 'completed';
}

export interface PTSession {
  id: string;
  client_id: string;
  purchase_id: string;
  trainer_id: string;
  session_datetime: string;
  duration_hours: number;
  session_status: 'completed' | 'scheduled' | 'cancelled';
  completed_by?: string;
  completion_timestamp?: string;
}

export interface PTCommission {
  id: string;
  trainer_id: string;
  session_id: string;
  duration_hours: number;
  hourly_rate_applied: number;
  commission_amount: number;
  cumulative_hours_before: number;
  cumulative_hours_after: number;
  commission_plan: 'PLAN_A' | 'PLAN_B';
  month_reference: string; // YYYY-MM
}
