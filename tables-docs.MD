# 📘 EzClassPay — โครงสร้างฐานข้อมูล (Database Schema)

ระบบ EzClassPay ใช้ **PostgreSQL** ผ่าน Prisma ORM มีทั้งหมด **7 ตาราง** ดังนี้

---

## 👤 User (`users`)

ตารางหลักสำหรับเก็บข้อมูลผู้ใช้ที่ล็อกอินผ่าน LINE

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `id` | UUID (PK) | ไอดีหลักของ user |
| `line_uid` | String (UNIQUE) | LINE User ID ใช้ยึดโยงกับบัญชี LINE |
| `display_name` | String | ชื่อที่แสดง (จาก LINE) |
| `picture_url` | String? | รูปโปรไฟล์ (จาก LINE) |
| `role` | String (`"MEMBER"` default) | บทบาทในระบบ (เช่น MEMBER, ADMIN) |
| `active_room_id` | String? | ห้องที่ user กำลัง active อยู่ |
| `created_at` | DateTime | วันที่สร้าง |
| `updated_at` | DateTime | วันที่อัปเดตล่าสุด |

**ความสัมพันธ์**
- `ownedRooms` → **Room** (หนึ่งคนเป็นเจ้าของหลายห้อง)
- `joinedRooms` → **RoomMember** (หนึ่งคนเป็นสมาชิกหลายห้อง)
- `payments` → **Payment** (หนึ่งคนจ่ายหลายครั้ง)
- `bills` → **Bill** (หนึ่งคนมีหลายบิล)

---

## 🏠 Room (`rooms`)

ตารางสำหรับเก็บข้อมูลห้อง/กลุ่ม แต่ละห้องจะมีผู้จัดการ 1 คน และสมาชิกหลายคน

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `id` | UUID (PK) | ไอดีหลักของห้อง |
| `manager_id` | String (FK → User) | ไอดีผู้จัดการห้อง (เจ้าของ) |
| `name` | String | ชื่อห้อง |
| `collection_type` | String (`"TARGET"` default) | วิธีเก็บเงิน: `TARGET` (เก็บตามเป้า) หรือ `PERIODIC` (เก็บรายงวด) |
| `total_target_amount` | Float? | จำนวนเงินเป้ารวม (ใช้กับแบบ TARGET) |
| `periodic_amount` | Float? | จำนวนเงินต่องวด (ใช้กับแบบ PERIODIC) |
| `promptpay_no` | String | เลขพร้อมเพย์สำหรับรับเงิน |
| `is_premium` | Boolean (default: false) | สถานะพรีเมียม |
| `expires_at` | DateTime? | วันหมดอายุ (พรีเมียม) |
| `line_group_id` | String? (UNIQUE) | LINE Group ID ที่เชื่อมต่อกับห้อง |
| `auto_billing_enabled` | Boolean (default: true) | เปิด/ปิด การออกบิลอัตโนมัติ |
| `billing_day_of_month` | Int? (default: 1) | วันที่ของเดือนที่ออกบิล (เช่น 1 = วันที่ 1 ของเดือน) |
| `created_at` | DateTime | วันที่สร้างห้อง |

**ความสัมพันธ์**
- `manager` → **User** (เจ้าของห้อง)
- `members` → **RoomMember** (สมาชิกในห้อง)
- `periods` → **Period** (งวดการเก็บเงิน)
- `expenses` → **Expense** (ค่าใช้จ่าย)
- `bills` → **Bill** (บิลรายเดือน)
- `payments` → **Payment** (การชำระเงิน)
- `subscriptions` → **Subscription** (การสมัครพรีเมียม)

---

## 👥 RoomMember (`room_members`)

ตารางกลางสำหรับความสัมพันธ์ **Many-to-Many** ระหว่าง User กับ Room
บอกว่า user ไหนอยู่ห้องไหนบ้าง

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `id` | UUID (PK) | ไอดีหลัก |
| `room_id` | String (FK → Room) | ไอดีห้อง |
| `user_id` | String (FK → User) | ไอดีผู้ใช้ |
| `joined_at` | DateTime | วันที่เข้าร่วมห้อง |

**Constraint**: ห้ามมีคู่ (roomId, userId) ซ้ำ

---

## 💰 Payment (`payments`)

ตารางบันทึก**การชำระเงิน**ทั้งหมดในระบบ

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `id` | UUID (PK) | ไอดีหลัก |
| `bill_id` | String? (FK → Bill) | เชื่อมโยงกับบิล (ถ้าจ่ายตามบิลรายเดือน) |
| `room_id` | String? (FK → Room) | ห้องที่จ่าย (ใช้สำหรับ TARGET — จ่ายตรงเข้ากองกลาง) |
| `line_uid` | String (FK → User.lineUid) | LINE UID ของผู้จ่าย |
| `slip_url` | String? | URL รูปสลิปการโอน |
| `amount` | Float | จำนวนเงินที่ชำระ |
| `status` | String (`"PENDING"` default) | สถานะ: `AWAITING_SLIP` (รอสลิป), `PENDING` (รอตรวจ), `APPROVED` (อนุมัติ), `REJECTED` (ปฏิเสธ) |
| `created_at` | DateTime | วันที่ชำระ |

**ความสัมพันธ์**
- `bill` → **Bill**
- `room` → **Room**
- `user` → **User** (ผ่าน `lineUid`)

---

## 🧾 Expense (`expenses`)

ตารางบันทึก**ค่าใช้จ่าย**ของห้อง (เช่น ค่าน้ำ ค่าไฟ ค่าอาหาร)

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `id` | Int (PK, auto increment) | ไอดีหลัก (ตัวเลข) |
| `title` | String | ชื่อรายการค่าใช้จ่าย |
| `amount` | Float | จำนวนเงิน |
| `receipt_url` | String? | URL รูปใบเสร็จ/หลักฐาน |
| `room_id` | String (FK → Room) | ห้องที่เป็นเจ้าของรายจ่าย |
| `created_at` | DateTime | วันที่บันทึก |

---

## 🧾 Bill (`bills`)

ตารางเก็บ**บิลประจำเดือน** แยกตาม user ในแต่ละห้อง
ใช้สำหรับระบบออกบิลอัตโนมัติ

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `id` | UUID (PK) | ไอดีหลักของบิล |
| `month` | Int | เดือน (1-12) |
| `year` | Int | ปี (ค.ศ.) |
| `due_date` | DateTime | วันที่ครบกำหนดชำระ |
| `amount` | Float | จำนวนเงินที่ต้องจ่าย |
| `status` | String (`"UNPAID"` default) | สถานะ: `UNPAID` (ค้างชำระ), `PAID` (จ่ายแล้ว) |
| `room_id` | String (FK → Room) | ห้อง |
| `user_id` | String (FK → User) | ผู้ที่ต้องชำระ |
| `created_at` | DateTime | วันที่สร้างบิล |
| `updated_at` | DateTime | วันที่อัปเดตล่าสุด |

**Constraint**: ห้ามมีคู่ (roomId, userId, month, year) ซ้ำ — user หนึ่งในห้องหนึ่งจะมีบิลแค่เดือนละ 1 ใบ

**ความสัมพันธ์**
- `room` → **Room**
- `user` → **User**
- `payments` → **Payment** (หนึ่งบิลมีหลายยอดชำระ)

---

## ⭐ Subscription (`subscriptions`)

ตารางเก็บประวัติการ**สมัครสมาชิกพรีเมียม** ผ่าน Stripe

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `id` | UUID (PK) | ไอดีหลัก |
| `room_id` | String (FK → Room) | ห้องที่สมัครพรีเมียม |
| `manager_id` | String | ไอดีผู้จัดการที่จ่าย |
| `stripe_intent_id` | String (UNIQUE) | Stripe PaymentIntent ID |
| `stripe_payment_id` | String? | Stripe Payment ID (หลังจ่ายสำเร็จ) |
| `amount` | Float | จำนวนเงินที่ชำระ |
| `currency` | String (default: `"thb"`) | สกุลเงิน |
| `status` | String (`"PENDING"` default) | สถานะ: `PENDING` (รอ), `COMPLETED` (สำเร็จ), `EXPIRED` (หมดอายุ) |
| `plan_days` | Int (default: 30) | จำนวนวันที่พรีเมียมมีอายุ |
| `created_at` | DateTime | วันที่สร้าง subscription |
| `completed_at` | DateTime? | วันที่ชำระสำเร็จ |

---

## 🔗 สรุปความสัมระหว่างตาราง

```
User ──┬──< Room (manager)           : 1 คน เป็นเจ้าของหลายห้อง
       ├──< RoomMember               : 1 คน อยู่หลายห้อง (N:M ผ่าน RoomMember)
       ├──< Payment                  : 1 คน จ่ายหลายครั้ง
       └──< Bill                     : 1 คน มีหลายบิล

Room ──┬──< RoomMember               : 1 ห้อง มีหลายสมาชิก
       ├──< Expense                  : 1 ห้อง มีหลายค่าใช้จ่าย
       ├──< Bill                     : 1 ห้อง มีหลายบิล
       ├──< Payment                  : 1 ห้อง มียอดชำระหลายยอด
       └──< Subscription             : 1 ห้อง สมัครพรีเมียมหลายครั้ง

Bill ──< Payment                     : 1 บิล มีหลายยอดชำระ
```
