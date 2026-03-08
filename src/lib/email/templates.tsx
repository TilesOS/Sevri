export function welcomeEmailTemplate(fullName: string) {
  return {
    subject: "Welcome to Sevri",
    html: `<p>Hey ${fullName},</p><p>Welcome to Sevri. Start by finishing onboarding so we can recommend a realistic project you can actually ship.</p>`,
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
    html: "<p>Your Pro plan is active. You now have full roadmap depth and premium portfolio tools.</p>",
  };
}
