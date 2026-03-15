"use client";

import { type ReactNode, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  projectTrackOptions,
  settingsProfileSchema,
  studentStageOptions,
  targetOutcomeOptions,
  type SettingsProfileInput,
} from "@/lib/validators/settings";

interface SettingsFormProps {
  email: string;
  initialValues: SettingsProfileInput;
}

const selectClassName =
  "w-full rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-sm text-ink-900";

export function SettingsForm({ email, initialValues }: SettingsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const form = useForm<SettingsProfileInput>({
    resolver: zodResolver(settingsProfileSchema),
    defaultValues: initialValues,
  });

  async function onSubmit(values: SettingsProfileInput) {
    setError(null);
    setInfo(null);

    const response = await fetch("/api/settings/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const body = (await response.json().catch(() => null)) as { message?: string; error?: string; details?: string } | null;

    if (!response.ok) {
      setError(body?.details ?? body?.error ?? "Failed to save settings.");
      return;
    }

    form.reset(values);
    setInfo(body?.message ?? "Settings saved.");
    router.refresh();
  }

  const {
    formState: { errors, isDirty, isSubmitting },
    register,
    handleSubmit,
  } = form;

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Profile details</h2>
        <p className="mt-1 text-sm text-ink-600">
          Update the defaults Sevri uses for your account, recommendations, and project direction.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Email"
            hint="Email is shown here for reference. This page currently saves your profile preferences and name."
          >
            <Input value={email} disabled className="bg-surface-subtle text-ink-600" />
          </Field>

          <Field label="Name" error={errors.full_name?.message}>
            <Input {...register("full_name")} placeholder="Alex Johnson" autoComplete="name" />
          </Field>

          <Field label="Student stage" error={errors.student_stage?.message}>
            <select className={selectClassName} {...register("student_stage")}>
              {studentStageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Target outcome" error={errors.target_outcome?.message}>
            <select className={selectClassName} {...register("target_outcome")}>
              {targetOutcomeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Default track"
            error={errors.project_track?.message}
            hint="This sets which project path Sevri should treat as your default for future recommendation runs."
          >
            <select className={selectClassName} {...register("project_track")}>
              {projectTrackOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {info ? <p className="text-sm text-mint-700">{info}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>

          <p className="text-sm text-ink-600">{isDirty ? "You have unsaved changes." : "Your settings are up to date."}</p>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium text-ink-700">
      <span>{label}</span>
      {children}
      {hint ? <span className="block text-xs font-normal text-ink-600">{hint}</span> : null}
      {error ? <span className="block text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}
