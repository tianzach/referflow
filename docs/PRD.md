## 💡 Project Overview: ReferFlow (Referral & Interview Collaboration Hub)

### Problem Statement
Job referrals are usually managed through scattered LinkedIn DMs, emails, and spreadsheets. Candidates struggle to track whether their referral was submitted or what stage they are in, while referrers get overwhelmed by repetitive requests, incomplete resumes/JDs, and tracking their monthly referral quotas. **ReferFlow** provides a single platform where candidates can submit structured referral requests and referrers can efficiently review, approve, and update application progress.

### Target Users & Roles
1. **Candidate**: Job seekers (students/new grads) looking for employee referrals and structured interview progress tracking.
2. **Referrer**: Industry professionals/alumni who offer referrals, manage monthly quotas, and share interview feedback.

### Core User Stories
1. As a **candidate**, I want to register and sign in to submit a referral request with a target company, role, job description, and resume link, so I can keep all my requests organized.
2. As a **candidate**, I want to track the live status of my requests (`Pending → Approved → Referred → Interviewing → Offer/Closed`) and read interview feedback, so I always know where I stand.
3. As a **candidate**, I want an AI assistant (built with the Claude Agent SDK) to analyze my background against a job description and generate a tailored referral blurb and interview prep checklist, so I can submit stronger requests.
4. As a **referrer**, I want to set my available companies and monthly referral quota, so I don't get overwhelmed by duplicate or excessive requests.
5. As a **referrer**, I want to review incoming requests in a structured queue, approve or decline them, and update their referral/interview status, so candidates stay informed without constant back-and-forth messages.
6. As a **referrer**, I want to leave private internal notes for myself as well as structured interview feedback visible to the candidate, with strict role-based access control protecting each user's data.

### Planned Tech Stack
- **Framework**: Next.js (App Router), TypeScript, Tailwind CSS
- **Database & ORM**: PostgreSQL + Prisma
- **Authentication**: Auth.js (NextAuth)
- **AI Integration**: Claude Agent SDK (JD/Resume matching & interview prep)
- **Testing**: Vitest (Unit/Integration), Playwright (E2E)
- **Deployment & CI/CD**: Vercel + GitHub Actions