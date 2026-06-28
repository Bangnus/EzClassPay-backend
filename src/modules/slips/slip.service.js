import { Jimp } from "jimp";
import jsQR from "jsqr";

/**
 * ป้องกันการ parse EMVCo TLV ผิดพลาด
 * สลิปโอนเงินไทยใช้มาตรฐาน EMVCo ซึ่งเป็น TLV (Tag 2 ตัวอักษร, Length 2 ตัวอักษร, Value ตาม Length)
 */
export function parsePromptPayPayload(payload) {
  if (!payload) return null;

  const result = {
    amount: null,
    receiver: null,
    ref1: null,
    ref2: null,
    raw: payload
  };

  try {
    let index = 0;
    while (index < payload.length) {
      const tag = payload.substring(index, index + 2);
      index += 2;
      const lengthStr = payload.substring(index, index + 2);
      const length = parseInt(lengthStr, 10);
      index += 2;
      const value = payload.substring(index, index + length);
      index += length;

      if (tag === "54") {
        result.amount = parseFloat(value);
      }
      
      // Tag 29 is Credit Transfer (PromptPay ID)
      if (tag === "29") {
        result.receiver = value;
      }

      // Tag 30 is Bill Payment
      if (tag === "30") {
        // Tag 30 contains sub-tags
        let subIndex = 0;
        while (subIndex < value.length) {
          const subTag = value.substring(subIndex, subIndex + 2);
          subIndex += 2;
          const subLenStr = value.substring(subIndex, subIndex + 2);
          const subLen = parseInt(subLenStr, 10);
          subIndex += 2;
          const subVal = value.substring(subIndex, subIndex + subLen);
          subIndex += subLen;
          
          if (subTag === "02") result.ref1 = subVal;
          if (subTag === "03") result.ref2 = subVal;
        }
      }
    }
  } catch (err) {
    console.error("Error parsing payload:", err);
  }

  return result;
}

/**
 * อ่านรูปภาพจาก Buffer และค้นหา QR Code ด้วย jsQR
 */
export async function readQrFromImage(imageBuffer) {
  try {
    // โหลดรูปภาพด้วย Jimp
    const image = await Jimp.read(imageBuffer);
    
    // ดึง Pixel data
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const imageData = new Uint8ClampedArray(image.bitmap.data);

    // ใช้ jsQR สแกน
    const code = jsQR(imageData, width, height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      return {
        success: true,
        data: code.data, // ข้อมูล text ใน QR
        payload: parsePromptPayPayload(code.data)
      };
    } else {
      return {
        success: false,
        error: "ไม่พบ QR Code หรือรูปภาพไม่ชัดเจน"
      };
    }
  } catch (err) {
    console.error("Error reading image:", err);
    return {
      success: false,
      error: "ไม่สามารถประมวลผลรูปภาพได้"
    };
  }
}
