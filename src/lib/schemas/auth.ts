import { z } from 'zod';

export const signInSchema = z.object({
    email: z
        .string({ required_error: 'Email is required' })
        .min(1, 'Email is required')
        .email('Invalid email'),
    password: z
        .string({ required_error: 'Password is required' })
        .min(1, 'Password is required')
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password must be less than 100 characters')
});

export type SignInSchema = z.infer<typeof signInSchema>;
