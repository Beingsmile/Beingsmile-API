import cloudinary from '../config/cloudinaryConfig.js';

export async function uploadImage(imagePath, publicId = null, options = {}) {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      public_id: publicId,
      resource_type: "auto",
      type: options.type || "upload", // 'upload' (public), 'private', or 'authenticated'
      ...options
    });
    return result;
  } catch (error) {
    throw error;
  }
}

export function getSignedUrl(publicId, resourceType = "image", type = "authenticated") {
  // Generates a URL that expires in 1 hour (3600 seconds)
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: type,
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
}

export function getOptimizedUrl(publicId) {
  return cloudinary.url(publicId, {
    fetch_format: 'auto',
    quality: 'auto',
    secure: true,
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
