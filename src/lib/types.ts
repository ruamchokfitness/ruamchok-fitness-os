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

export interface MaintenanceFollowUp {
  date: string;
  note: string;
  author: string;
}

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
  completed: boolean;
  timestamp: any; // Firestore timestamp
  followUps: MaintenanceFollowUp[];
}

export interface Sale {
  id: string;
  date: any; // Firestore timestamp or Date
  memberId: string;
  memberName: string;
  product: string;
  revenueType: string;
  paymentType: string;
  amount: number;
  salesperson: string;
}

export interface SalesEmployee {
  id: string;
  name: string;
  position: string;
}

export interface Product {
  id: string;
  name: string;
  category: 'Membership' | 'Personal Training' | 'Daily Pass' | 'Proshop' | 'Food & Beverage';
  defaultPrice: number;
  order?: number;
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
  member_id?: string;
  phone?: string;
  status: 'active' | 'inactive';
}

export interface PTTrainer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  commission_plan: string;
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
  clientSignature?: string;
  trainerSignature?: string;
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
  commission_plan: string;
  commission_type: string;
  month_reference: string; // YYYY-MM
}

export interface PTCommissionTier {
  maxHours: number;
  rate: number;
}

export interface PTCommissionPlan {
  id: string;
  name: string;
  tiers: PTCommissionTier[];
  isDeletable?: boolean; // Default plans are not deletable
}

export type PARQ = {
    id: string;
    clientId: string;
    date: string;
    dob?: string;
    emergencyTel?: string;
    trainerToComplete?: string;
    medicalProfile: {
        [key: string]: boolean;
    };
    otherMedicalCondition?: string;
    medicalReleaseRequired: boolean;
    fitnessGoals: ('fatLoss' | 'building' | 'toning')[];
    otherFitnessGoals?: string;
    assessmentGoals?: {
      bodyMass?: number,
      bloodPressure?: string,
      restingHR?: number,
      bodyFat?: number,
      shoulders?: number,
      chest?: number,
      arms?: string,
      waist?: number,
      hips?: number,
      thighs?: string,
      calves?: string,
    }
    clientSignature?: string;
};


export type PhysicalAssessment = {
    id: string;
    clientId: string;
    assessmentDate: string;
    trainerName: string;
    assessmentType: 'Start' | '2 Week Reassessment' | '6 Week Reassessment';
    height?: number;
    bodyMass?: number;
    bloodPressure?: string;
    restingHR?: number;
    bodyFat?: number;
    shoulders?: number;
    chest?: number;
    arms?: string;
    waist?: number;
    hips?: number;
    thighs?: string;
    calves?: string;
    fitTestScore?: number;
    treadmillLevel?: number;
    sitReachScore?: number;
    bmi?: number;
};


// RCF Group Class Attendance Tracker
export interface GroupClass {
  id: string;
  name: string;
}

export interface GroupClassInstructor {
  id: string;
  name: string;
}

export interface GroupClassTime {
  id: string;
  name: string; // e.g., "09:00"
}

export interface GroupClassAttendance {
  id: string;
  type: 'attendance';
  date: string; // "DD/MM/YYYY"
  month_year: string; // "MM/YYYY"
  day_of_week: string;
  time: string;
  class_name: string;
  instructor: string;
  attendance: number;
  created_at: any; // Firestore Timestamp
}
    