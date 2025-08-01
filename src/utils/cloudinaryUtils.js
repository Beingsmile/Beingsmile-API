import cloudinary from '../config/cloudinaryConfig.js';

export async function uploadImage(imagePath, publicId = null) {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      public_id: publicId,
    });
    return result;
  } catch (error) {
    throw error;
  }
}

export function getOptimizedUrl(publicId) {
  return cloudinary.url(publicId, {
    fetch_format: 'auto',
    quality: 'auto',
  });
}

export function getAutoCropUrl(publicId) {
  return cloudinary.url(publicId, {
    crop: 'auto',
    gravity: 'auto',
    width: 500,
    height: 500,
  });
}
