import type { Employee, Leave, Quota, Policy, VacationTier, PublicHoliday, CustomHoliday } from './types';

// In-memory store
let employees: Employee[] = [
  { id: 'emp1', name: 'ประเทศ โสมานัส' },
  { id: 'emp2', name: 'สมชาย เข็มกลัด' },
  { id: 'emp3', name: 'ยิ่งยง ยอดบัวงาม' },
  { id: 'emp4', name: 'มนัส บุญจำนงค์' },
  { id: 'emp5', name: 'อาทิวราห์ คงมาลัย' },
];

let leaves: Leave[] = [
    { id: 'leave1', employeeId: 'emp1', date: '2024-07-10', type: 'พักร้อน', days: 1 },
    { id: 'leave2', employeeId: 'emp1', date: '2024-08-12', type: 'วันแม่', days: 1 },
    { id: 'leave3', employeeId: 'emp2', date: '2024-07-15', type: 'พักร้อน', days: 2 },
];

let quotas: Quota[] = [
  { employeeId: 'emp1', vacation: 6, holiday: 8, birthday: 1, holidayPermissions: ['วันแม่', 'วันพ่อ', 'วันแรงงาน'] },
  { employeeId: 'emp2', vacation: 8, holiday: 8, birthday: 1, holidayPermissions: ['วันแม่', 'วันพ่อ', 'วันแรงงาน', 'วันปิยะมหาราช'] },
  { employeeId: 'emp3', vacation: 10, holiday: 8, birthday: 1, holidayPermissions: ['วันแม่', 'วันพ่อ', 'วันแรงงาน'] },
  { employeeId: 'emp4', vacation: 6, holiday: 4, birthday: 0, holidayPermissions: [] },
  { employeeId: 'emp5', vacation: 15, holiday: 8, birthday: 1, holidayPermissions: ['วันแม่', 'วันพ่อ', 'วันแรงงาน', 'วันปิยะมหาราช', 'วันคล้ายวันสวรรคต ร.9'] },
];

let policies: Policy[] = [
    { key: 'system_title', value: 'RuamChok Fitness HRM'},
    { key: 'notes_header_text', value: 'หมายเหตุ'},
    { key: 'vacation_policy_text', value: '*พนักงานที่มีอายุงานครบ 1 ปีขึ้นไป สามารถใช้สิทธิ์พักร้อนได้ 6 วันต่อปี' },
    { key: 'holiday_policy_text', value: '**สิทธิ์วันหยุดนักขัตฤกษ์ ใช้ได้ 8 วันต่อปี (ไม่รวมปีใหม่-สงกรานต์เนื่องจากหยุดตามปีปฏิทิน)' },
    { key: 'holiday_restriction_text', value: '***นักขัตฤกษ์ใช้วันซ้ำกันไม่ได้ ยกเว้นใช้สิทธิ์หยุดไปแค่ 0.5 วัน' },
    { key: 'holiday_year_text', value: 'สิทธิ์วันหยุดนักขัตฤกษ์ที่ใช้ได้'},
];

let vacationTiers: VacationTier[] = [
  { id: 'vt1', years: 'ครบ 1 ปี', days: '6 วัน' },
  { id: 'vt2', years: 'ครบ 3 ปี', days: '8 วัน' },
  { id: 'vt3', years: 'ครบ 5 ปี', days: '10 วัน' },
  { id: 'vt4', years: 'ครบ 6 ปี', days: '11 วัน' },
  { id: 'vt5', years: 'ครบ 7 ปี', days: '12 วัน' },
  { id: 'vt6', years: 'ครบ 8 ปี', days: '13 วัน' },
  { id: 'vt7', years: 'ครบ 9 ปี', days: '14 วัน' },
  { id: 'vt8', years: 'ครบ 10 ปีขึ้นไป', days: '15 วัน' },
];

let publicHolidays: PublicHoliday[] = [
  { id: 'ph1', name: 'วันมาฆบูชา', date: '3 มีนาคม 2569' },
  { id: 'ph2', name: 'วันแรงงาน', date: '1 พฤษภาคม 2569' },
  { id: 'ph3', name: 'วันวิสาขบูชา', date: '1 มิถุนายน 2569' },
  { id: 'ph4', name: 'วันอาสาฬหบูชา', date: '29 มิถุนายน 2569' },
  { id: 'ph5', name: 'วันแม่', date: '12 สิงหาคม 2569' },
  { id: 'ph6', name: 'วันคล้ายวันสวรรคต ร.9', date: '13 ตุลาคม 2569' },
  { id: 'ph7', name: 'วันปิยะมหาราช', date: '23 ตุลาคม 2569' },
  { id: 'ph8', name: 'วันพ่อ', date: '5 ธันวาคม 2569' },
];

let customHolidays: CustomHoliday[] = [
    { id: 'ch1', name: 'วันหยุดพิเศษบริษัท' },
];

const simulateDelay = () => new Promise(res => setTimeout(res, Math.random() * 500));

// --- Employee ---
export const getEmployees = async (): Promise<Employee[]> => { await simulateDelay(); return [...employees]; };
export const addEmployee = async (employee: Employee): Promise<void> => { await simulateDelay(); employees.push(employee); };
export const updateEmployee = async (updatedEmployee: Employee): Promise<void> => {
  await simulateDelay();
  employees = employees.map(e => e.id === updatedEmployee.id ? updatedEmployee : e);
};

// --- Leave ---
export const getLeaves = async (): Promise<Leave[]> => { await simulateDelay(); return [...leaves]; };
export const addLeave = async (leave: Leave): Promise<void> => { await simulateDelay(); leaves.push(leave); };
export const updateLeave = async (updatedLeave: Leave): Promise<void> => {
  await simulateDelay();
  leaves = leaves.map(l => l.id === updatedLeave.id ? updatedLeave : l);
};
export const deleteLeave = async (id: string): Promise<void> => {
  await simulateDelay();
  leaves = leaves.filter(l => l.id !== id);
};

// --- Quota ---
export const getQuotas = async (): Promise<Quota[]> => { await simulateDelay(); return [...quotas]; };
export const upsertQuota = async (quota: Quota): Promise<void> => {
  await simulateDelay();
  const index = quotas.findIndex(q => q.employeeId === quota.employeeId);
  if (index > -1) {
    quotas[index] = quota;
  } else {
    quotas.push(quota);
  }
};

// --- Policy ---
export const getPolicies = async (): Promise<Policy[]> => { await simulateDelay(); return [...policies]; };
export const updatePolicy = async (updatedPolicy: Policy): Promise<void> => {
  await simulateDelay();
  policies = policies.map(p => p.key === updatedPolicy.key ? updatedPolicy : p);
};

// --- Vacation Tier ---
export const getVacationTiers = async (): Promise<VacationTier[]> => { await simulateDelay(); return [...vacationTiers]; };
export const updateVacationTier = async (updatedTier: VacationTier): Promise<void> => {
  await simulateDelay();
  vacationTiers = vacationTiers.map(t => t.id === updatedTier.id ? updatedTier : t);
};

// --- Public Holiday ---
export const getPublicHolidays = async (): Promise<PublicHoliday[]> => { await simulateDelay(); return [...publicHolidays]; };
export const updatePublicHoliday = async (updatedHoliday: PublicHoliday): Promise<void> => {
  await simulateDelay();
  publicHolidays = publicHolidays.map(h => h.id === updatedHoliday.id ? updatedHoliday : h);
};

// --- Custom Holiday ---
export const getCustomHolidays = async (): Promise<CustomHoliday[]> => { await simulateDelay(); return [...customHolidays]; };
export const addCustomHoliday = async (holiday: CustomHoliday): Promise<void> => { await simulateDelay(); customHolidays.push(holiday); };
export const deleteCustomHoliday = async (id: string): Promise<void> => {
  await simulateDelay();
  customHolidays = customHolidays.filter(h => h.id !== id);
};
