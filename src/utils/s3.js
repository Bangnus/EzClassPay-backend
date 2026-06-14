const getBaseUrl = () => process.env.BUCKET_SERVICE_URL || 'http://localhost:3001';

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
  return result.data.url;
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
