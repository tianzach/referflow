import { describe, expect, it } from "vitest";
import { newReferralRequestSchema } from "./request-input";

const validInput = {
  referrerId: "ref_123",
  company: "  Stripe ",
  roleTitle: " New Grad Software Engineer ",
  jobDescription:
    "Build and operate payment APIs used by millions of businesses. Experience with TypeScript is a plus.",
  jobUrl: "https://stripe.com/jobs/listing/new-grad-swe/123",
  resumeUrl: "https://drive.google.com/file/d/abc/view",
  candidateNote: "We met at the NEU alumni panel.",
};

describe("newReferralRequestSchema", () => {
  it("accepts a complete request and trims text fields", () => {
    const result = newReferralRequestSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.company).toBe("Stripe");
    expect(result.data?.roleTitle).toBe("New Grad Software Engineer");
  });

  it("treats candidateNote as optional", () => {
    const { candidateNote: _omit, ...withoutNote } = validInput;
    expect(newReferralRequestSchema.safeParse(withoutNote).success).toBe(true);
  });

  it("rejects a missing or blank company", () => {
    expect(newReferralRequestSchema.safeParse({ ...validInput, company: "   " }).success).toBe(
      false,
    );
    const { company: _omit, ...withoutCompany } = validInput;
    expect(newReferralRequestSchema.safeParse(withoutCompany).success).toBe(false);
  });

  it("rejects a job description shorter than 50 characters", () => {
    const result = newReferralRequestSchema.safeParse({ ...validInput, jobDescription: "SWE" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["jobDescription"]);
  });

  it.each([
    ["http (not https)", "http://drive.google.com/file/d/abc"],
    ["javascript: scheme", "javascript:alert(1)"],
    ["not a URL", "my resume"],
  ])("rejects a resume link that is %s", (_label, resumeUrl) => {
    const result = newReferralRequestSchema.safeParse({ ...validInput, resumeUrl });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["resumeUrl"]);
  });

  it("rejects a non-https job URL", () => {
    const result = newReferralRequestSchema.safeParse({
      ...validInput,
      jobUrl: "ftp://jobs.example.com/1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a candidate note longer than 1000 characters", () => {
    const result = newReferralRequestSchema.safeParse({
      ...validInput,
      candidateNote: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
