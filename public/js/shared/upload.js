import { ApiError, api as request } from './api.js';

// Sends a file to storage and returns the id that the next request refers to.
export async function uploadFile(file, { kind, startPath, api = request }) {
  const target = await api(startPath, { method: 'POST', body: { kind, name: file.name, size: file.size } });
  let response;
  try {
    response = await fetch(target.url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': target.contentType, ...target.headers },
    });
  } catch {
    throw new ApiError('Файл жіберілмеді. Интернетті тексеріп, қайталап көріңіз.', 0);
  }
  if (!response.ok) throw new ApiError('Файл жіберілмеді. Қайталап көріңіз.', response.status);
  return target.id;
}

// Uploads the form's file, then posts its text fields together with the upload id.
export async function sendFileForm(data, { startPath, path, api = request }) {
  const { file, ...fields } = Object.fromEntries(data);
  const uploadId = await uploadFile(file, { kind: 'document', startPath, api });
  await api(path, { method: 'POST', body: { ...fields, uploadId } });
}
