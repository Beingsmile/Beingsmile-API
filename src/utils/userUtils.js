import slugify from "slugify";
import crypto from "crypto";
import User from "../models/User.js";

/**
 * Generates a unique slug for a user based on their name.
 * @param {string} name - The user's full name.
 * @returns {Promise<string>} - A unique slug.
 */
export const generateUniqueSlug = async (name) => {
  let baseSlug = slugify(name, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  while (await User.exists({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

/**
 * Hashes an identity number (NID, Passport, etc.) for cross-checking.
 * @param {string} idNumber - The raw identity number.
 * @returns {string} - The SHA-256 hash.
 */
export const hashIdentityNumber = (idNumber) => {
  return crypto.createHash("sha256").update(idNumber.trim()).digest("hex");
};
