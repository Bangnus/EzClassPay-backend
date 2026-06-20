# EzClassPay Backend API Summary

สรุปเส้นทาง API ทั้งหมดของระบบ EzClassPay (อ้างอิงจาก `src/routes/index.js` และ route ภายใน module ต่างๆ)

**รูปแบบ Response ทั่วไป (Global Response Format):**
API ส่วนใหญ่จะตอบกลับในรูปแบบ JSON ดังนี้:
```json
{
  "success": true,
  "message": "Success",
  "data": { ... } // หรือเป็น Array [ ... ]
}
```
หากมีข้อผิดพลาด:
```json
{
  "success": false,
  "message": "Error message description",
  "errors": ["Optional array of validation errors"]
}
```

---

## 1. General & System API
เส้นทางหลักของระบบและ Webhook สำหรับ LINE

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | ตรวจสอบสถานะการทำงานของ Server |
| `GET` | `/api/files/:filename` | ดึงไฟล์ภาพหรือสลิปที่ถูกอัปโหลดไว้ |
| `POST` | `/api/webhook/line` | Webhook รับ Event จาก LINE |

**Example Response (`GET /api/health`):**
```json
{
  "status": "ok",
  "timestamp": "2026-06-20T01:30:00.000Z"
}
```

---

## 2. Auth API (`/api/auth`)
การจัดการสิทธิ์และการเข้าสู่ระบบ

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/line-login` | เข้าสู่ระบบด้วย LINE Login |
| `POST` | `/api/auth/sync` | ซิงค์ข้อมูลผู้ใช้จาก LINE Profile |
| `GET` | `/api/auth/me` | ดึงข้อมูล Profile ของผู้ใช้ปัจจุบัน |

**Example `POST /api/auth/line-login`:**
- **Body:**
  ```json
  {
    "lineToken": "ey..."
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Success",
    "data": {
      "token": "jwt_token_here",
      "user": {
        "id": "uuid",
        "lineUid": "U12345",
        "displayName": "User Name",
        "role": "MEMBER"
      }
    }
  }
  ```

---

## 3. Users API (`/api/users`)
การจัดการผู้ใช้งานในระบบ

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/users` | ดึงรายชื่อผู้ใช้ทั้งหมด (Manager Only) |
| `GET` | `/api/users/:id` | ดึงข้อมูลผู้ใช้งานตาม ID |
| `PATCH` | `/api/users/:id` | แก้ไขข้อมูลผู้ใช้งานตาม ID |
| `DELETE` | `/api/users/:id` | ลบผู้ใช้งาน (Manager Only) |

**Example `PATCH /api/users/:id`:**
- **Body:**
  ```json
  {
    "role": "MANAGER"
  }
  ```

---

## 4. Rooms API (`/api/rooms`)
การจัดการห้องเก็บเงินกองกลาง

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/rooms/my-rooms` | ดึงห้องของผู้ใช้ (`?lineUid=xxx`) |
| `GET` | `/api/rooms` | ดึงรายชื่อห้องทั้งหมดในระบบ |
| `GET` | `/api/rooms/by-group/:groupId` | ดึงข้อมูลห้องจาก LINE Group ID |
| `GET` | `/api/rooms/:id` | ดึงข้อมูลห้องตาม ID |
| `POST` | `/api/rooms` | สร้างห้องเก็บเงินใหม่ |
| `PATCH` | `/api/rooms/:id` | อัปเดตข้อมูลห้อง (ชื่อห้อง, จำนวนเงิน) |
| `DELETE` | `/api/rooms/:id` | ลบห้อง (Manager Only) |
| `POST` | `/api/rooms/:id/sync-members` | อัปเดต/ซิงค์รายชื่อสมาชิกในห้อง |
| `GET` | `/api/rooms/:id/members` | ดูรายชื่อสมาชิกทั้งหมดในห้อง |
| `DELETE` | `/api/rooms/:id/members/:userId` | ลบผู้ใช้ออกจากห้อง |

**Example `POST /api/rooms`:**
- **Body:**
  ```json
  {
    "name": "ค่าห้อง 6/1",
    "collection_type": "MONTHLY",
    "total_target_amount": null,
    "periodic_amount": 500,
    "promptpay_no": "0812345678",
    "line_uid": "U1234567",
    "line_group_id": "C12345"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "สร้างห้องสำเร็จเรียบร้อย!",
    "data": {
      "id": "room-uuid",
      "name": "ค่าห้อง 6/1",
      "collectionType": "MONTHLY",
      "periodicAmount": 500
    }
  }
  ```

**Example `PATCH /api/rooms/:id`:**
- **Body:**
  ```json
  {
    "name": "ชื่อห้องใหม่",
    "totalTargetAmount": 1000,
    "periodicAmount": 200
  }
  ```

---

## 5. Expenses API (`/api/expenses`)
การจัดการรายจ่าย / รายการใช้จ่ายของกองกลาง

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/expenses` | สร้างรายการใช้จ่ายใหม่ |
| `GET` | `/api/expenses/:id` | ดึงข้อมูลรายการใช้จ่ายตาม ID |
| `GET` | `/api/expenses/room/:roomId` | ดึงรายการใช้จ่ายทั้งหมดของห้อง |

**Example `POST /api/expenses`:**
- **Body:**
  ```json
  {
    "title": "ซื้ออุปกรณ์ทำความสะอาด",
    "amount": 250,
    "roomId": "room-uuid"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Success",
    "data": {
      "id": 1,
      "title": "ซื้ออุปกรณ์ทำความสะอาด",
      "amount": 250
    }
  }
  ```

---

## 6. Bills API (`/api/bills`)
การจัดการบิลรายบุคคลที่ต้องจ่ายของแต่ละคน

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/bills/generate` | สร้างบิลเรียกเก็บเงินให้สมาชิก (รายเดือน) |
| `GET` | `/api/bills/room/:roomId` | ดูบิลในห้อง (รองรับ Query `?userId=xxx`) |
| `GET` | `/api/bills/user/:userId` | ดึงบิลของผู้ใช้ (ทุกห้อง) |
| `GET` | `/api/bills/:id` | ดึงข้อมูลรายละเอียดบิลตาม ID |
| `PATCH` | `/api/bills/:id/status` | อัปเดตสถานะบิล |

**Example `POST /api/bills/generate`:**
- **Body:**
  ```json
  {
    "month": 6,
    "year": 2026
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Bills generated successfully",
    "data": [
      {
        "roomId": "room-uuid",
        "roomName": "ห้อง 6/1",
        "count": 30
      }
    ]
  }
  ```

**Example `PATCH /api/bills/:id/status`:**
- **Body:**
  ```json
  {
    "status": "PAID" // UNPAID, PAID, OVERDUE, CANCELLED
  }
  ```

---

## 7. Payments API (`/api/payments`)
การจัดการส่งสลิปโอนเงินและการชำระเงิน

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/payments/initiate` | เริ่มการชำระเงินเพื่อส่งสลิป |
| `PATCH` | `/api/payments/:id/approve` | อนุมัติการชำระเงิน |
| `PATCH` | `/api/payments/:id/reject` | ปฏิเสธการชำระเงิน |
| `GET` | `/api/payments/room/:roomId/pending` | ดูรายการชำระเงินที่รอตรวจสอบ |
| `GET` | `/api/payments/room/:roomId/history` | ดูประวัติจ่าย (รองรับ Query `?userId=xxx`) |

**Example `POST /api/payments/initiate`:**
- **Body:**
  ```json
  {
    "lineUid": "U12345",
    "roomId": "room-uuid"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Payment initiated",
    "data": {
      "id": "payment-uuid",
      "status": "AWAITING_SLIP",
      "roomId": "room-uuid",
      "lineUid": "U12345"
    }
  }
  ```

**Example Response (`GET /api/payments/room/:roomId/history?userId=xxx`):**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "payment-uuid",
      "periodId": "period-uuid",
      "roomId": "room-uuid",
      "lineUid": "U12345",
      "slipUrl": "https://...",
      "status": "APPROVED",
      "createdAt": "2026-06-20T01:30:00.000Z",
      "period": {
        "id": "period-uuid",
        "name": "งวดที่ 1 (แรกเข้า)",
        "amount": 500
      }
    }
  ]
}
```
