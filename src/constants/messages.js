// ============ ข้อความ Reply/Push ทั้งหมดของบอท ============
// แก้ไขข้อความได้ที่ไฟล์นี้ที่เดียว  ไม่ต้องไล่หาตาม handler

// ---------- กลุ่ม Join ----------
export const GROUP_WELCOME = `สวัสดีครับกลุ่มใหม่! 👋 ผมบอท EzClassPay\nพร้อมช่วยคุณจัดการเงินกองกลางแล้วครับ\n\nกรุณาเลือกตัวเเทนของห้อง หรือดำเนินการตั้งค่าห้องผ่านแชทนี้ก่อนใช้งานครับ 👆`;

// ---------- ทักทายทั่วไป ----------
export const GREETING = `สวัสดีครับ! เรียกใช้ EzClassPay มีอะไรให้ผมช่วยไหมครับ? 👇`;

// ---------- ห้อง ----------
export const ROOM_SWITCH_BACK = `กลับสู่หน้าหลักเรียบร้อยครับ เลือกห้องที่ต้องการจัดการได้เลย 👆`;
export const ROOM_NOT_FOUND = `ไม่พบข้อมูลห้องนี้ครับ`;

export const welcomeManager = (name) => `ยินดีต้อนรับ Manager ห้อง "${name}" ครับ 👑`;
export const welcomeMember = (name) => `คุณกำลังจัดการห้อง "${name}" ในฐานะสมาชิกครับ 😊`;

export const NO_ROOMS = `คุณยังไม่มีห้องที่เข้าร่วมอยู่ครับ กรุณาให้ผู้ดูแลเพิ่มคุณในห้องหรือสร้างห้องใหม่ครับ 🙏`;

export const ROOM_SWITCH_LOCKED = 'คุณกำลังใช้งานห้องนี้อยู่ กรุณากด "ออกจากห้อง" ก่อนเปลี่ยนห้องครับ 🙏';
export const ROOM_LEFT = 'ออกจากห้องเรียบร้อย';

// ---------- งวด / การจ่ายเงิน ----------
export const NO_PERIODS = `ยังไม่มีรายการงวดที่ต้องจ่ายในขณะนี้ครับ 🎉`;
export const PERIOD_NOT_FOUND = `ไม่พบข้อมูลงวดนี้ กรุณาลองใหม่อีกครั้งครับ`;

export const paymentDetail = (periodName, amount, promptpayNo) =>
  `📋 รายการ: ${periodName}\n💰 ยอดโอน: ${amount} บาท\n🏦 พร้อมเพย์: ${promptpayNo}`;

export const SEND_SLIP_PROMPT = `👉 โอนเสร็จแล้ว ส่งรูปสลิปเข้ามาในแชทนี้ได้เลยครับ 📸`;

export const NO_PENDING_SLIP = `❌ ไม่พบรายการรอสลิป กรุณากด "💸 จ่ายเงิน" เพื่อเลือกงวดที่ต้องการจ่ายก่อนครับ`;
export const slipSaved = (periodName) =>
  `✅ บันทึกสลิปสำหรับ "${periodName}" เรียบร้อยแล้วครับ!\nแอดมินจะทำการตรวจสอบเร็วๆ นี้ครับ ⏳`;
export const SLIP_ERROR = `❌ ขออภัยครับ เกิดข้อผิดพลาดในการบันทึกรูปภาพ กรุณาลองใหม่อีกครั้ง`;

// ---------- สรุปยอด ----------
export const NOT_REGISTERED = `ยังไม่ได้ลงทะเบียนในระบบครับ กรุณาแอดบอทเป็นเพื่อนก่อน 🙏`;
export const NO_MEMBERSHIP = `คุณยังไม่ได้เป็นสมาชิกห้องไหนเลยครับ 📭`;

export const roomSummary = (roomName, totalPaid, totalTarget, periodCount) => {
  const targetText = totalTarget > 0 ? `${totalTarget} บาท` : 'ไม่ได้ตั้งเป้า';
  return `📊 สรุปยอดห้อง "${roomName}"\n\n💰 เก็บได้แล้ว: ${totalPaid} บาท\n📌 เป้าหมาย: ${targetText}\n📆 จำนวนงวด: ${periodCount} งวด`;
};

export const allRoomsSummary = (summaryText) =>
  `📊 สรุปยอดรวมทุกห้องของคุณ\n\n${summaryText}`;

// ---------- คู่มือ ----------
export const MANUAL = `📖 คู่มือการใช้งาน EzClassPay\n\n1️⃣ เพิ่มบอทเข้าห้อง LINE\n2️⃣ ตั้งค่าห้องผ่าน LIFF\n3️⃣ สร้างงวดเก็บเงิน\n4️⃣ ลูกบ้านกด "💸 จ่ายเงิน"\n5️⃣ ส่งสลิปเพื่อยืนยัน\n\n📌 สอบถามเพิ่มเติม: ติดต่อผู้ดูแลระบบ`;

export const UNKNOWN_COMMAND = `ไม่เข้าใจคำสั่งครับ 🙏 พิมพ์ "คู่มือการใช้งาน" เพื่อดูคำสั่งที่ใช้ได้`;

// ---------- ข้อความแจ้งเตือนห้อง ----------
export const ROOM_NOT_SETUP = `ยังไม่ได้ตั้งค่าห้องนี้ในระบบครับ รบกวนผู้ดูแลดำเนินการก่อน 🙏`;

// ---------- ป้าย / Label ใน Flex ----------
export const LABEL_PROMPTPAY = `เลขพร้อมเพย์`;
export const LABEL_CREATOR = `ผู้สร้าง`;
export const LABEL_TYPE = `ประเภท`;
export const LABEL_AMOUNT = `จำนวนเงิน`;
export const LABEL_PAYMENT_AMOUNT = `ยอดที่ต้องจ่าย`;
export const LABEL_STATUS = `สถานะ`;
export const LABEL_ROLE_MANAGER = `จัดการ`;
export const LABEL_ROLE_MEMBER = `สมาชิก`;

// ---------- ปุ่ม ----------
export const BTN_CREATE_ROOM = `👑 สร้างห้องกองกลาง`;
export const BTN_PAY_CHECK = `💸 จ่ายเงิน/เช็กยอด`;
export const BTN_SUMMARY = `📊 ดูยอดรวม`;
export const BTN_SELECT_ROOM = `เลือกห้องนี้`;
export const BTN_PAY_PERIOD = `💸 กดเพื่อจ่ายงวดนี้`;

// ---------- สถานะการจ่ายเงิน ----------
export const STATUS_NOT_PAID = `รอจ่าย`;
export const STATUS_PAID = `จ่ายแล้ว`;
export const STATUS_PENDING = `รอตรวจสอบ`;
export const STATUS_AWAITING_SLIP = `รอสลิป`;

// ---------- ประเภทการเก็บ ----------
export const COLLECTION_TARGET = `มีเป้าหมายรวม`;
export const COLLECTION_FIXED = `ยอดคงที่ (รายเดือน)`;

// ---------- displayText ----------
export const displaySelectingRoom = (name) => `กำลังเลือกห้อง ${name}`;
export const displayPayingPeriod = (name) => `กำลังจ่าย ${name}`;

// ---------- altText สำหรับ Flex ----------
export const ALT_ROOM_LIST = `รายการห้องทั้งหมด`;
export const ALT_PERIOD_LIST = `รายการงวดที่ต้องชำระเงิน`;
export const ALT_ROOM_CREATED = `สร้างห้องกองกลางสำเร็จ!`;

// ---------- Flex สร้างห้องสำเร็จ ----------
export const ROOM_CREATED_HEADER = `สร้างห้องกองกลางสำเร็จ!`;

// ---------- Error HTTP (ส่งกลับ API) ----------
export const ERR_USER_NOT_FOUND = `ไม่พบผู้ใช้งาน กรุณาทักแชทบอทเพื่อลงทะเบียนก่อน`;
export const ERR_DUPLICATE_ROOM = `กลุ่มนี้มีการตั้งห้องกองกลางไว้แล้ว ไม่สามารถสร้างซ้ำได้ครับ`;
export const ERR_ROOM_NOT_FOUND = `Room not found`;
export const ERR_NOT_AUTHORIZED_UPDATE = `Not authorized to update this room`;
export const ERR_NOT_AUTHORIZED_DELETE = `Not authorized to delete this room`;
