const getBaseUrl = () => process.env.BUCKET_SERVICE_URL || 'http://localhost:3001';
const getPublicUrl = () => process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}`;

export const uploadToS3 = async (fileBuffer, fileName, contentType) => {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: contentType });
  formData.append('file', blob, fileName);

  const response = await fetch(`${getBaseUrl()}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'File upload failed');
  }

  const result = await response.json();
  const minioUrl = result.data.url;
  const filename = minioUrl.split('/').pop();
  return `${getPublicUrl()}/api/files/${filename}`;
};

export const deleteFile = async (filename) => {
  const response = await fetch(`${getBaseUrl()}/api/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'File deletion failed');
  }
};
