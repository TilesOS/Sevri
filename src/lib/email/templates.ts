import type { EmailTemplate } from "@/lib/email/types";

interface OptionalFooter {
  postalAddress: string;
  unsubscribeUrl: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

function layout(args: {
  title: string;
  preview: string;
  body: string;
  text: string;
  footer?: OptionalFooter;
}): Pick<EmailTemplate, "preview" | "html" | "text"> {
  const footer = args.footer
    ? `<p style="margin-top:32px;font-size:12px;line-height:1.6;color:#64748b;">Sevri, ${escapeHtml(args.footer.postalAddress)}<br/><a href="${escapeHtml(args.footer.unsubscribeUrl)}" style="color:#475569;">Unsubscribe from coaching emails</a></p>`
    : `<p style="margin-top:32px;font-size:12px;line-height:1.6;color:#64748b;">Questions? Reply to this email or contact support@sevri.co.</p>`;
  const textFooter = args.footer
    ? `\n\nSevri, ${args.footer.postalAddress}\nUnsubscribe: ${args.footer.unsubscribeUrl}`
    : "\n\nQuestions? Reply to this email or contact support@sevri.co.";

  return {
    preview: args.preview,
    html: `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(args.preview)}</div><div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a;"><p style="margin:0 0 20px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;">Sevri</p><h1 style="font-size:22px;line-height:1.3;margin:0 0 18px;">${escapeHtml(args.title)}</h1>${args.body}${footer}</div>`,
    text: `${args.title}\n\n${args.text}${textFooter}`,
  };
}

function action(url: string, label: string) {
  const safeUrl = escapeHtml(url);
  return `<p style="margin:26px 0;"><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

export function welcomeEmailTemplate(fullName: string, siteUrl: string): EmailTemplate {
  const name = escapeHtml(fullName || "there");
  const preview = "Your Sevri workspace is ready.";
  return {
    subject: "Welcome to Sevri",
    ...layout({
      title: "Welcome to Sevri",
      preview,
      body: `<p style="font-size:15px;line-height:1.7;">Hey ${name},</p><p style="font-size:15px;line-height:1.7;">Your workspace is ready. Sevri will help you choose a realistic project in any field, turn it into a roadmap, and keep moving one useful step at a time.</p>${action(`${siteUrl}/onboarding`, "Continue in Sevri")}`,
      text: `Hey ${fullName || "there"},\n\nYour workspace is ready. Sevri will help you choose a realistic project, turn it into a roadmap, and keep moving one useful step at a time.\n\nContinue: ${siteUrl}/onboarding`,
    }),
  };
}

export function activationEmailTemplate(args: {
  day: 3 | 7;
  siteUrl: string;
  footer: OptionalFooter;
}): EmailTemplate {
  const day3 = args.day === 3;
  const title = day3 ? "Want help choosing a project?" : "Your project can start small";
  const copy = day3
    ? "A few focused answers are enough for Sevri to suggest realistic project directions based on your interests, time, resources, and goals."
    : "You do not need the perfect idea before you begin. Pick a direction that feels useful, then let the roadmap turn it into manageable steps.";
  return {
    subject: day3 ? "A project direction built around you" : "Start with one believable project",
    ...layout({
      title,
      preview: copy,
      body: `<p style="font-size:15px;line-height:1.7;">${escapeHtml(copy)}</p>${action(`${args.siteUrl}/onboarding`, "Choose my project")}`,
      text: `${copy}\n\nChoose your project: ${args.siteUrl}/onboarding`,
      footer: args.footer,
    }),
  };
}

export function roadmapReadyTemplate(projectTitle: string, siteUrl: string, projectId: string): EmailTemplate {
  const safeTitle = escapeHtml(projectTitle);
  return {
    subject: "Your Sevri roadmap is ready",
    ...layout({
      title: "Your roadmap is ready",
      preview: `The next steps for ${projectTitle} are waiting in Sevri.`,
      body: `<p style="font-size:15px;line-height:1.7;">The roadmap for <strong>${safeTitle}</strong> is ready. Open it to review the scope, milestones, and the first concrete thing to work on.</p>${action(`${siteUrl}/project/${projectId}`, "Open my roadmap")}`,
      text: `The roadmap for ${projectTitle} is ready. Review the scope, milestones, and your first concrete step.\n\nOpen it: ${siteUrl}/project/${projectId}`,
    }),
  };
}

export function coachEmailTemplate(args: {
  day: 7 | 14;
  projectTitle: string;
  projectId: string;
  stepTitle?: string | null;
  curatedSubject?: string | null;
  curatedBody?: string | null;
  siteUrl: string;
  footer: OptionalFooter;
}): EmailTemplate {
  const isFirst = args.day === 7;
  const fallback = isFirst
    ? `Momentum does not require a big session. Reopen ${args.projectTitle} and spend 15 minutes on the next visible step.`
    : `${args.projectTitle} has been quiet for two weeks. Shrink the next move until it is easy to restart, or pause the project without guilt.`;
  const copy = args.curatedBody?.trim() || fallback;
  const step = args.stepTitle
    ? `<p style="font-size:14px;line-height:1.7;padding:14px 16px;background:#f8fafc;border-radius:8px;"><strong>Next step:</strong> ${escapeHtml(args.stepTitle)}</p>`
    : "";
  return {
    subject: safeSubject(args.curatedSubject ?? "") || (isFirst ? "A small restart for your Sevri project" : "Make the next step smaller"),
    ...layout({
      title: isFirst ? "A little momentum still counts" : "Your project is still here",
      preview: fallback,
      body: `<p style="font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(copy)}</p>${step}${action(`${args.siteUrl}/project/${args.projectId}`, "Continue my project")}`,
      text: `${copy}${args.stepTitle ? `\n\nNext step: ${args.stepTitle}` : ""}\n\nContinue: ${args.siteUrl}/project/${args.projectId}`,
      footer: args.footer,
    }),
  };
}

export function upgradeConfirmationTemplate(siteUrl: string): EmailTemplate {
  return {
    subject: "Sevri Pro is active",
    ...layout({
      title: "Your Pro plan is active",
      preview: "Your Sevri Pro features are ready.",
      body: `<p style="font-size:15px;line-height:1.7;">You now have expanded idea generation, detailed step coaching, and work evaluation.</p>${action(`${siteUrl}/dashboard`, "Open Sevri")}`,
      text: `You now have expanded idea generation, detailed step coaching, and work evaluation.\n\nOpen Sevri: ${siteUrl}/dashboard`,
    }),
  };
}

interface ReviewerInvitationArgs {
  inviterName: string;
  projectTitle: string;
  acceptUrl: string;
  personalNote?: string;
}

export function reviewerInvitationTemplate(args: ReviewerInvitationArgs): EmailTemplate {
  const inviter = escapeHtml(args.inviterName);
  const title = escapeHtml(args.projectTitle);
  const note = args.personalNote?.trim();
  const noteBlock = note
    ? `<div style="margin:20px 0;padding:16px 18px;border-left:3px solid #94a3b8;background:#f8fafc;color:#1f2937;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(note)}<div style="margin-top:8px;color:#64748b;font-size:12px;">— ${inviter}</div></div>`
    : "";
  return {
    subject: safeSubject(`${args.inviterName} invited you to review their Sevri project`),
    ...layout({
      title: "You've been invited to review on Sevri",
      preview: `${args.inviterName} invited you to review ${args.projectTitle}.`,
      body: `<p style="font-size:15px;line-height:1.7;"><strong>${inviter}</strong> invited you to review <strong>${title}</strong>.</p>${noteBlock}<p style="font-size:14px;line-height:1.7;color:#334155;">Reviewers can see progress and leave structured milestone feedback. Reviewer accounts are free.</p>${action(args.acceptUrl, "Accept invitation")}`,
      text: `${args.inviterName} invited you to review ${args.projectTitle}.${note ? `\n\n${note}` : ""}\n\nAccept: ${args.acceptUrl}`,
    }),
  };
}
