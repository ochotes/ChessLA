import { z } from "zod";

const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;

export const registerSchema = z.object({
  username: z.string().regex(usernamePattern, "Username must be 3-20 characters: letters, numbers, underscores."),
  fullName: z.string().trim().min(1, "Full name is required.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long.")
    .regex(/[A-Za-z]/, "Password must include a letter.")
    .regex(/\d/, "Password must include a number."),
  country: z.string().trim().length(2, "Select a country."),
  profilePicture: z.string().url().max(2048).optional().nullable(),
  website: z.string().max(0, "Spam detected.").optional(), // honeypot
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email."),
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
  website: z.string().max(0).optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Za-z]/, "Password must include a letter.")
    .regex(/\d/, "Password must include a number."),
});
