import { z } from "zod";

const httpsUrl = z.url({ protocol: /^https$/ });

export const newReferralRequestSchema = z.object({
  referrerId: z.string().trim().min(1),
  company: z.string().trim().min(1).max(100),
  roleTitle: z.string().trim().min(1).max(120),
  jobDescription: z.string().trim().min(50).max(20_000),
  jobUrl: httpsUrl,
  resumeUrl: httpsUrl,
  candidateNote: z.string().trim().max(1000).optional(),
});

export type NewReferralRequestInput = z.infer<typeof newReferralRequestSchema>;
