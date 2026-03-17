import { EditableTextItem } from "./editable-text-item";
import { updatePolicy } from "@/lib/actions";
import type { Policy } from "@/lib/types";

interface PolicyNotesProps {
  policies: Policy[];
}

export function PolicyNotes({ policies }: PolicyNotesProps) {
    const getPolicy = (key: string, defaultValue: string) => policies.find(p => p.key === key)?.value || defaultValue;

    return (
        <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
                {getPolicy('notes_header_text', 'หมายเหตุ')}
            </h3>
            <div className="space-y-3 text-sm text-gray-700">
                <EditableTextItem
                    itemKey="vacation_policy_text"
                    initialValue={getPolicy('vacation_policy_text', '*พนักงานที่มีอายุงานครบ 1 ปีขึ้นไป สามารถใช้สิทธิ์พักร้อนได้ 6 วันต่อปี')}
                    label="Vacation Policy"
                    action={updatePolicy}
                    collectionName="policies"
                />
                <EditableTextItem
                    itemKey="holiday_policy_text"
                    initialValue={getPolicy('holiday_policy_text', '**สิทธิ์วันหยุดนักขัตฤกษ์ ใช้ได้ 8 วันต่อปี (ไม่รวมปีใหม่-สงกรานต์เนื่องจากหยุดตามปีปฏิทิน)')}
                    label="Holiday Policy"
                    action={updatePolicy}
                    collectionName="policies"
                />
                <EditableTextItem
                    itemKey="holiday_restriction_text"
                    initialValue={getPolicy('holiday_restriction_text', '***นักขัตฤกษ์ใช้วันซ้ำกันไม่ได้ ยกเว้นใช้สิทธิ์หยุดไปแค่ 0.5 วัน')}
                    label="Holiday Restriction"
                    action={updatePolicy}
                    collectionName="policies"
                />
            </div>
        </div>
    );
}
