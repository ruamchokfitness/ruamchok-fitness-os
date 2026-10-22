
export type User = {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

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

export interface MaintenanceReport {
  id: string;
  date: string;
  responsible: string;
  category: string;
  maintenanceItem: string;
  completed: boolean;
  timestamp: any; // Firestore timestamp
  followUps?: MaintenanceFollowUp[];
}

export interface MaintenanceFollowUp {
  date: string;
  note: string;
  author: string;
}

export interface MaintenanceCategory {
  id: string;
  name: string;
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
  date: string; // "DD/MM/YYYY"
  month_year: string; // "MM/YYYY"
  day_of_week: string;
  time: string;
  class_name: string;
  instructor: string;
  attendance: number;
  created_at: any; // Firestore Timestamp
  instructorSignature?: string;
  staffName?: string;
  staffSignature?: string;
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
  status: 'active' | 'inactive';
  commission_plan: string;
}

export interface PTPackage {
  id: string;
  client_id: string;
  package_name: string;
  hours_purchased: number;
  price_paid: number;
  price_per_hour: number;
  purchase_date: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD
  status: 'active' | 'completed' | 'expired';
  hours_used: number;
  hours_remaining: number;
}

export interface PTSession {
  id: string;
  client_id: string;
  purchase_id: string;
  trainer_id: string;
  session_datetime: string; // ISO 8601
  duration_hours: number;
  session_status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  completed_by?: string;
  completion_timestamp?: string; // ISO 8601
  clientSignature?: string; // Data URL
  trainerSignature?: string; // Data URL
  is_checked?: boolean;
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
    isDeletable?: boolean;
}

export interface PARQ {
    id: string;
    clientId: string;
    createdAt: any;
    dob?: string;
    emergencyTel?: string;
    trainerToComplete?: string;
    medicalProfile?: { [key: string]: boolean };
    otherMedicalCondition?: string;
    medicalReleaseRequired?: boolean;
    fitnessGoals?: string[];
    otherFitnessGoals?: string;
    assessmentGoals?: Partial<PhysicalAssessment>;
    trainerNotes?: string;
    clientSignature?: string;
}

export interface PhysicalAssessment {
    id: string;
    clientId: string;
    assessmentType: 'Start' | '2 Week Reassessment' | '6 Week Reassessment';
    assessmentDate?: string;
    trainerName?: string;
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
}

export interface PTWorkout {
    id: string;
    clientId: string;
    packageId: string;
    sessionNumber: number;
    date?: string;
    focus?: string;
    exercises?: Array<{
        name?: string;
        sets?: string;
        reps?: string;
        weight?: string;
        rest?: string;
    }>;
    trainerNotes?: string;
    clientFeedback?: string;
}

export interface AssessmentSession {
  sessionNumber: number;
  dateTime: string; // ISO string
  trainerName: string;
  clientSignature: string; // Data URL
}

export interface AssessmentServiceRecord {
  id: string;
  memberId: string;
  fullName: string;
  date: string; // YYYY-MM-DD
  trainingProgram: 'Personal Training 1 Session' | 'Personal Training 3 Sessions' | 'Free Trial 1 Session';
  sessions: AssessmentSession[];
  status: 'active' | 'completed';
  remark?: string;
}

// Day Pass Coupon Types
export type DayPassPackageType = 
  | 'Daily Full Membership'
  | 'Daily Standard Membership'
  | 'Daily Full Membership (SN/STD)'
  | 'Daily Standard Membership (SN/STD)'
  | string;

export type DayPassPaymentMethod = 'cash' | 'transfer' | 'credit_card';

export interface DayPassTicket {
  id: string;
  ticket_no: string;          // e.g. "DP09770"
  seq_number: number;         // e.g. 9770
  date: string;               // YYYY-MM-DD
  client_name: string;        // Full Name / ชื่อ-สกุล
  phone: string;              // Phone / เบอร์โทรศัพท์
  locker_no?: string;         // Locker No.
  package_type: DayPassPackageType;
  price: number;
  payment_method: DayPassPaymentMethod;
  client_signature?: string;  // Data URL (base64 PNG)
  staff_signature?: string;   // Data URL (base64 PNG)
  staff_name?: string;
  created_at: any;            // Firestore Timestamp
}

export interface DayPassStaff {
  id: string;
  name: string;
  created_at?: any;
}


