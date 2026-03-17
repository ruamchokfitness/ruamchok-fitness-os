"use server";

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
} from "firebase/firestore";
import { db } from "@/firebase/server";
import type {
  Employee,
  Leave,
  Quota,
  Policy,
  VacationTier,
  PublicHoliday,
  CustomHoliday,
} from "./types";

// --- Collection References ---
const employeesCollection = collection(db, "employees");
const leavesCollection = collection(db, "leaves");
const quotasCollection = collection(db, "quotas");
const policiesCollection = collection(db, "policies");
const vacationTiersCollection = collection(db, "vacationTiers");
const publicHolidaysCollection = collection(db, "publicHolidays");
const customHolidaysCollection = collection(db, "customHolidays");

const getCollectionData = async <T>(q: any): Promise<T[]> => {
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
};

// --- Employee ---
export const getEmployees = async (): Promise<Employee[]> =>
  getCollectionData<Employee>(query(employeesCollection));
export const addEmployee = async (employee: Employee): Promise<void> => {
  await setDoc(doc(employeesCollection, employee.id), employee);
};
export const updateEmployee = async (
  updatedEmployee: Partial<Employee> & { id: string }
): Promise<void> => {
  await setDoc(doc(employeesCollection, updatedEmployee.id), updatedEmployee, {
    merge: true,
  });
};
export const deleteEmployee = async (id: string): Promise<void> => {
    const batch = writeBatch(db);

    // Delete employee
    batch.delete(doc(employeesCollection, id));

    // Delete associated leaves
    const leavesQuery = query(leavesCollection, where => where("employeeId", "==", id));
    const leavesSnapshot = await getDocs(leavesQuery);
    leavesSnapshot.forEach(doc => batch.delete(doc.ref));

    // Delete associated quota
    const quotaDoc = doc(quotasCollection, id);
    batch.delete(quotaDoc);

    await batch.commit();
};

// --- Leave ---
export const getLeaves = async (): Promise<Leave[]> =>
  getCollectionData<Leave>(query(leavesCollection));
export const addLeave = async (leave: Leave): Promise<void> => {
  await setDoc(doc(leavesCollection, leave.id), leave);
};
export const updateLeave = async (updatedLeave: Leave): Promise<void> => {
  await setDoc(doc(leavesCollection, updatedLeave.id), updatedLeave, {
    merge: true,
  });
};
export const deleteLeave = async (id: string): Promise<void> => {
  await deleteDoc(doc(leavesCollection, id));
};

// --- Quota ---
export const getQuotas = async (): Promise<Quota[]> =>
  getCollectionData<Quota>(query(quotasCollection));
export const upsertQuota = async (quota: Quota): Promise<void> => {
  // Use employeeId as the document ID for quotas for a 1:1 relationship
  await setDoc(doc(quotasCollection, quota.employeeId), quota, {
    merge: true,
  });
};

// --- Policy ---
export const getPolicies = async (): Promise<Policy[]> =>
  getCollectionData<Policy>(query(policiesCollection));
export const updatePolicy = async (updatedPolicy: Policy): Promise<void> => {
  await setDoc(doc(policiesCollection, updatedPolicy.key), updatedPolicy);
};

// --- Vacation Tier ---
export const getVacationTiers = async (): Promise<VacationTier[]> =>
  getCollectionData<VacationTier>(query(vacationTiersCollection));
export const updateVacationTier = async (
  updatedTier: VacationTier
): Promise<void> => {
  await setDoc(doc(vacationTiersCollection, updatedTier.id), updatedTier);
};

// --- Public Holiday ---
export const getPublicHolidays = async (): Promise<PublicHoliday[]> =>
  getCollectionData<PublicHoliday>(query(publicHolidaysCollection));
export const updatePublicHoliday = async (
  updatedHoliday: PublicHoliday
): Promise<void> => {
  await setDoc(
    doc(publicHolidaysCollection, updatedHoliday.id),
    updatedHoliday
  );
};

// --- Custom Holiday ---
export const getCustomHolidays = async (): Promise<CustomHoliday[]> =>
  getCollectionData<CustomHoliday>(query(customHolidaysCollection));
export const addCustomHoliday = async (holiday: CustomHoliday): Promise<void> => {
  await setDoc(doc(customHolidaysCollection, holiday.id), holiday);
};
export const deleteCustomHoliday = async (id: string): Promise<void> => {
  await deleteDoc(doc(customHolidaysCollection, id));
};

// --- Initial Data Seeding (for first-time setup) ---
export const seedInitialData = async () => {
    const employeesSnapshot = await getDocs(query(employeesCollection, limit(1)));
    if (employeesSnapshot.empty) {
        console.log("No employees found. Seeding initial data...");
        const batch = writeBatch(db);

        const initialEmployees: Employee[] = [
          { id: 'emp1', name: 'ประเทศ โสมานัส' },
          { id: 'emp2', name: 'สมชาย เข็มกลัด' },
        ];
        
        const initialQuotas: Quota[] = [
          { employeeId: 'emp1', vacation: 6, holiday: 8, birthday: 1, holidayPermissions: ['วันแม่', 'วันพ่อ', 'วันแรงงาน'] },
          { employeeId: 'emp2', vacation: 8, holiday: 8, birthday: 1, holidayPermissions: ['วันแม่', 'วันพ่อ', 'วันแรงงาน', 'วันปิยะมหาราช'] },
        ];

        const initialPolicies: Policy[] = [
            { key: 'system_title', value: 'RuamChok Fitness HRM'},
            { key: 'notes_header_text', value: 'หมายเหตุ'},
            { key: 'vacation_policy_text', value: '*พนักงานที่มีอายุงานครบ 1 ปีขึ้นไป สามารถใช้สิทธิ์พักร้อนได้ 6 วันต่อปี' },
            { key: 'holiday_policy_text', value: '**สิทธิ์วันหยุดนักขัตฤกษ์ ใช้ได้ 8 วันต่อปี (ไม่รวมปีใหม่-สงกรานต์เนื่องจากหยุดตามปีปฏิทิน)' },
            { key: 'holiday_restriction_text', value: '***นักขัตฤกษ์ใช้วันซ้ำกันไม่ได้ ยกเว้นใช้สิทธิ์หยุดไปแค่ 0.5 วัน' },
            { key: 'holiday_year_text', value: 'สิทธิ์วันหยุดนักขัตฤกษ์ที่ใช้ได้'},
        ];

        const initialVacationTiers: VacationTier[] = [
          { id: 'vt1', years: 'ครบ 1 ปี', days: '6 วัน' },
          { id: 'vt2', years: 'ครบ 3 ปี', days: '8 วัน' },
          { id: 'vt3', years: 'ครบ 5 ปี', days: '10 วัน' },
        ];
        
        const initialPublicHolidays: PublicHoliday[] = [
          { id: 'ph1', name: 'วันมาฆบูชา', date: '3 มีนาคม 2569' },
          { id: 'ph2', name: 'วันแรงงาน', date: '1 พฤษภาคม 2569' },
        ];

        initialEmployees.forEach(e => batch.set(doc(employeesCollection, e.id), e));
        initialQuotas.forEach(q => batch.set(doc(quotasCollection, q.employeeId), q));
        initialPolicies.forEach(p => batch.set(doc(policiesCollection, p.key), p));
        initialVacationTiers.forEach(vt => batch.set(doc(vacationTiersCollection, vt.id), vt));
        initialPublicHolidays.forEach(ph => batch.set(doc(publicHolidaysCollection, ph.id), ph));
        
        await batch.commit();
        console.log("Initial data seeded successfully.");
    }
}
