export function welcomeEmailTemplate(fullName: string) {
  return {
    subject: "Welcome to Sevri",
    html: `<p>Hey ${fullName},</p><p>Welcome to Sevri. Start by finishing onboarding so we can recommend a realistic software or research project path you can actually finish.</p>`,
  };
}

export function roadmapReadyTemplate(projectTitle: string) {
  return {
    subject: "Your Sevri roadmap is ready",
    html: `<p>Your roadmap for <strong>${projectTitle}</strong> is ready inside Sevri.</p>`,
  };
}

export function upgradeConfirmationTemplate() {
  return {
    subject: "Sevri Pro is active",
    html: "<p>Your Pro plan is active. You now have unlimited idea board generations, subject to fair-use and rate limits, plus detailed step coaching and evaluation.</p>",
  };
}

interface ReviewerInvitationArgs {
  inviterName: string;
  projectTitle: string;
  acceptUrl: string;
  personalNote?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function reviewerInvitationTemplate(args: ReviewerInvitationArgs) {
  const inviter = escapeHtml(args.inviterName);
  const title = escapeHtml(args.projectTitle);
  const url = args.acceptUrl;
  const note = args.personalNote?.trim();

  const noteBlock = note
    ? `<div style="margin:20px 0;padding:16px 18px;border-left:3px solid #94a3b8;background:#f8fafc;color:#1f2937;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
        note,
      )}<div style="margin-top:8px;color:#64748b;font-size:12px;">— ${inviter}</div></div>`
    : "";

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a;">
  <h1 style="font-size:20px;margin:0 0 16px;font-weight:600;">You've been invited to review on Sevri</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px;"><strong>${inviter}</strong> invited you to review <strong>${title}</strong>.</p>
  ${noteBlock}
  <p style="font-size:14px;line-height:1.6;margin:20px 0;color:#334155;">Sevri helps students pick and finish realistic portfolio projects. As a reviewer, you'll see their progress and leave structured feedback on each milestone. You won't edit their work or be billed &mdash; reviewer accounts are free.</p>
  <p style="margin:28px 0;">
    <a href="${url}" style="display:inline-block;padding:12px 22px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Accept invitation</a>
  </p>
  <p style="font-size:12px;color:#64748b;margin:20px 0 0;line-height:1.5;">If the button doesn't work, copy and paste this link into your browser:<br/><span style="word-break:break-all;">${url}</span></p>
  <p style="margin-top:32px;font-size:13px;color:#64748b;">&mdash; The Sevri team</p>
</div>
  `.trim();

  return {
    subject: `${args.inviterName} invited you to review their Sevri project`,
    html,
  };
}
