
"use server";

import { revalidatePath } from "next/cache";
import * as data from "./data";
import type { Employee, Leave, Quota, CustomHoliday } from "./types";

// --- Employee Actions ---

export async function addEmployee(name: string): Promise<{ success: boolean }> {
  if (!name.trim()) {
    return { success: false };
  }
  const newEmployee: Employee = {
    id: `emp${Date.now()}`,
    name: name.trim(),
  };
  await data.addEmployee(newEmployee);

  // Also create a default quota
  const defaultQuota: Quota = {
    employeeId: newEmployee.id,
    vacation: 0,
    holiday: 0,
    birthday: 0,
    holidayPermissions: [],
  };
  await data.upsertQuota(defaultQuota);
  
  revalidatePath("/");
  return { success: true };
}

export async function updateEmployeeName(id: string, name: string): Promise<void> {
  await data.updateEmployee({ id, name });
  revalidatePath("/");
}

// --- Leave Actions ---

export async function addOrUpdateLeave(formData: FormData): Promise<{ success: boolean, message?: string }> {
  const employeeId = formData.get("employeeId") as string;
  const leaveId = formData.get("leaveId") as string | undefined;
  const leave: Leave = {
    id: leaveId || `leave${Date.now()}`,
    employeeId,
    date: formData.get("date") as string,
    type: formData.get("type") as string,
    days: Number(formData.get("days")),
  };

  const quotas = await data.getQuotas();
  const leaves = await data.getLeaves();
  const allHolidays = [...(await data.getPublicHolidays()), ...(await data.getCustomHolidays())].map(h => h.name);
  const quota = quotas.find(q => q.employeeId === employeeId);

  if (!quota) {
    return { success: false, message: "ไม่พบข้อมูลโควต้าของพนักงาน" };
  }
  
  // Validation
  const isHolidayLeave = allHolidays.includes(leave.type);
  let currentLeaves = leaves.filter(l => l.employeeId === employeeId);
  if (leaveId) {
    currentLeaves = currentLeaves.filter(l => l.id !== leaveId);
  }

  if(leave.type === "พักร้อน") {
    const used = currentLeaves.filter(l => l.type === "พักร้อน").reduce((sum, l) => sum + l.days, 0);
    if(used + leave.days > quota.vacation) return { success: false, message: `สิทธิ์พักร้อนไม่เพียงพอ คงเหลือ ${quota.vacation - used} วัน` };
  } else if (leave.type === "วันเกิด") {
    const used = currentLeaves.filter(l => l.type === "วันเกิด").reduce((sum, l) => sum + l.days, 0);
    if(used + leave.days > quota.birthday) return { success: false, message: `สิทธิ์วันเกิดไม่เพียงพอ คงเหลือ ${quota.birthday - used} วัน` };
  } else if (isHolidayLeave) {
    const used = currentLeaves.filter(l => allHolidays.includes(l.type)).reduce((sum, l) => sum + l.days, 0);
    if(used + leave.days > quota.holiday) return { success: false, message: `สิทธิ์วันหยุดนักขัตฤกษ์ไม่เพียงพอ คงเหลือ ${quota.holiday - used} วัน` };

    const alreadyTaken = currentLeaves.find(l => l.type === leave.type);
    if (alreadyTaken && (alreadyTaken.days + leave.days > 1)) {
        return { success: false, message: `ไม่สามารถใช้วันหยุด ${leave.type} ซ้ำได้` };
    }
  }


  if (leaveId) {
    await data.updateLeave(leave);
  } else {
    await data.addLeave(leave);
  }
  revalidatePath("/");
  return { success: true };
}

export async function deleteLeave(id: string): Promise<void> {
  await data.deleteLeave(id);
  revalidatePath("/");
}

// --- Quota Actions ---

export async function updateQuota(formData: FormData): Promise<void> {
  const employeeId = formData.get("employeeId") as string;
  const permissions = formData.getAll("permissions") as string[];

  const newQuota: Quota = {
    employeeId,
    vacation: Number(formData.get("vacation")),
    holiday: Number(formData.get("holiday")),
    birthday: Number(formData.get("birthday")),
    holidayPermissions: permissions,
  };
  await data.upsertQuota(newQuota);
  revalidatePath("/");
}

// --- Policy & Settings Actions ---

export async function updatePolicy(key: string, value: string): Promise<void> {
  await data.updatePolicy({ key, value });
  revalidatePath("/");
}

export async function updateVacationTier(id: string, years: string, days: string): Promise<void> {
  await data.updateVacationTier({ id, years, days });
  revalidatePath("/");
}

export async function updatePublicHoliday(id: string, date: string): Promise<void> {
  const holiday = await data.getPublicHolidays().then(h => h.find(holiday => holiday.id === id));
  if (holiday) {
    await data.updatePublicHoliday({ ...holiday, date });
  }
  revalidatePath("/");
}

export async function addCustomHoliday(name: string): Promise<{success: boolean}> {
  if (!name.trim()) return { success: false };
  const newHoliday: CustomHoliday = {
    id: `custom${Date.now()}`,
    name: name.trim(),
  };
  await data.addCustomHoliday(newHoliday);
  revalidatePath("/");
  return { success: true };
}

export async function deleteCustomHoliday(id: string): Promise<void> {
  await data.deleteCustomHoliday(id);
  revalidatePath("/");
}
