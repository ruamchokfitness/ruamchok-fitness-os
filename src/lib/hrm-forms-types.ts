export type HrmFormType = 'leave' | 'overtime' | 'timesheet' | 'internal_memo' | 'resignation';

export interface HrmLeaveFormData {
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  swapWith?: string;
  hospitalNote?: string;
}

export interface HrmOvertimeFormData {
  otType: 'overtime' | 'holiday';
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason: string;
}

export interface HrmTimesheetFormData {
  date: string;
  timeType: 'in' | 'out' | 'break_in' | 'break_out' | 'missed';
  actualTime: string;
  reason: string;
}

export interface HrmInternalMemoFormData {
  topic: string;
  to: string;
  details: string;
  urgency?: 'normal' | 'urgent';
}

export interface HrmResignationFormData {
  startDate?: string;
  lastWorkingDate: string;
  reason: string;
  feedback?: string;
}

export interface HrmEFormSubmission {
  id: string;
  formType: HrmFormType;
  formNumber: string;
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  date: string;
  signature: string;
  status: 'pending' | 'approved' | 'rejected';
  formData: Record<string, any>;
  createdAt?: any;
  approvedBy?: string;
  approvedAt?: any;
}

export const HRM_FORM_CONFIGS: Record<
  HrmFormType,
  {
    titleTh: string;
    titleEn: string;
    prefix: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  leave: {
    titleTh: 'ใบลางาน',
    titleEn: 'Leave Form',
    prefix: 'LV',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    borderColor: 'border-blue-200',
  },
  overtime: {
    titleTh: 'ใบทำงานล่วงเวลา',
    titleEn: 'Overtime Form (O.T.)',
    prefix: 'OT',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
    borderColor: 'border-orange-200',
  },
  timesheet: {
    titleTh: 'ใบบันทึกการลงเวลาทำงาน',
    titleEn: 'Timesheet Form',
    prefix: 'TS',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    borderColor: 'border-emerald-200',
  },
  internal_memo: {
    titleTh: 'ใบติดต่องานภายใน / ขอเอกสาร',
    titleEn: 'Internal Memo / Document Request',
    prefix: 'IM',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
    borderColor: 'border-purple-200',
  },
  resignation: {
    titleTh: 'ใบลาออก',
    titleEn: 'Resignation Form',
    prefix: 'RES',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 hover:bg-rose-100',
    borderColor: 'border-rose-200',
  },
};
