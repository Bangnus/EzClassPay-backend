import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'ap-southeast-1',
  endpoint: process.env.S3_ENDPOINT, // จำเป็นสำหรับ 3rd party S3 (เช่น Supabase, MinIO, Cloudflare R2)
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true, // มักจะเปิดไว้สำหรับ 3rd party S3
});

export const uploadToS3 = async (fileBuffer, fileName, contentType) => {
  if (!process.env.S3_BUCKET_NAME) {
    console.warn("⚠️ S3_BUCKET_NAME is not set. Skipping upload and returning dummy URL.");
    return `https://dummy-bucket.s3.amazonaws.com/slips/${fileName}`;
  }

  const key = `slips/${Date.now()}-${fileName}`;
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    // ACL: 'public-read' // เปิดใช้ถ้า Bucket อนุญาต
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);
  
  // สร้าง Public URL กลับไป
  if (process.env.S3_PUBLIC_URL) {
     return `${process.env.S3_PUBLIC_URL}/${key}`;
  }
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
};
