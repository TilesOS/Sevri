# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sevri primarily serves students ages 13 and older, especially high-school and early-college students who want to complete a meaningful project in any field. Their goal may be learning, a portfolio, an internship, college applications, a class, a competition, community impact, or personal growth.

Reviewers and mentors are secondary users. They participate in invited project-review workflows while the student remains the owner of the work and its voice.

## Product Purpose

Sevri helps a student choose, scope, execute, and package an authentic project they can realistically finish. Success means the student moves from an interest and a real-world time budget to completed work they understand, can explain, and are proud to show.

## Positioning

Sevri is project-to-portfolio coaching, not an idea generator. It uses a student's interests, experience, available time, and constraints to produce three comparable project directions, makes effort and ambition trade-offs explicit, and turns the student's choice into a finishable roadmap with execution support and credible proof of work.

## Operating Context

- Students complete one four-step intake covering interests, purpose, preferred shape, and real-world constraints.
- Sevri generates three directions for comparison before the student commits.
- A selected direction becomes a project workspace with scope, a roadmap, steps, guidance, scheduling, and portfolio preparation.
- Any project may use GitHub when a repository helps document the work; project schedules can use Google Calendar integration.
- Students can invite reviewers or mentors and can publish a shareable project portfolio page.
- The product supports free and paid access through a web SaaS subscription model.

## Capabilities and Constraints

- Physical, digital, investigative, creative, community, venture, and hybrid projects share one product model.
- Format preferences guide ideas but never gate features.
- Recommendations and roadmaps must reflect the student's actual experience, resources, time, and other constraints.
- Students under 13 cannot create an account through the standard signup flow; a parent or guardian must contact support.
- Student data and integration credentials require privacy-conscious handling.
- Public portfolio pages are intentionally shared by link rather than made searchable by default.
- Generated content must preserve student ownership and must not fabricate accomplishments, evidence, sources, or results.
- Sevri is an accessible web product.

## Brand Commitments

- The product name is **Sevri**.
- The voice is direct, encouraging, student-centered, and honest about trade-offs.
- Sevri favors realistic scope and momentum over inflated ambition or polish for its own sake.
- Product language should describe roadmap items as **steps** and the main authenticated area as the **project workspace**.
- The student's own judgment, understanding, and voice must remain visible in finished work.

## Evidence on Hand

- Product positioning and public claims: `src/app/(marketing)/page.tsx`
- Implemented product architecture and core flow: `README.md` and `CLAUDE.md`
- Student intake fields and supported outcomes: `src/lib/validators/onboarding.ts`
- Implemented project, reviewer, calendar, integration, and portfolio flows: `src/app/`, `src/components/`, and `src/lib/`
- Privacy commitments and data categories: `src/app/(marketing)/privacy/page.tsx`
- Current terminology authority: `src/lib/copy/glossary.ts`
- No customer testimonials, outcome benchmarks, institutional endorsements, press claims, or other external proof are established in the repository and must not be invented.

## Product Principles

1. **Make completion credible.** Fit every direction and roadmap to the student's real time, experience, resources, and constraints.
2. **Preserve student ownership.** Coach the work without replacing the student's judgment, understanding, or voice.
3. **Make trade-offs visible.** Help students compare effort, ambition, method, and scope before committing.
4. **Turn work into proof.** Carry a project through execution and reflection so the result is specific, explainable, and worth showing.
5. **Protect trust.** Handle student data carefully, support accessible use, and never manufacture evidence or outcomes.

## Accessibility & Inclusion

Sevri must support accessible web use. Guidance and interface language should remain understandable to students with different fields, resources, experience levels, and project-planning backgrounds.
