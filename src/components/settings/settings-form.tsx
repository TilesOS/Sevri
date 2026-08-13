"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  projectGoalOptions,
  settingsProfileSchema,
  studentStageOptions,
  type SettingsProfileInput,
} from "@/lib/validators/settings";

interface SettingsFormProps {
  email: string;
  initialValues: SettingsProfileInput;
}

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
        <h2 className="text-lg font-semibold text-ink">Profile details</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Update the defaults Sevri uses for your account, recommendations, and project direction.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div aria-live="polite" className="sr-only">
          {info ?? error ?? (isSubmitting ? "Saving settings." : "")}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Email"
            hint="Email is shown here for reference. This page currently saves your profile preferences and name."
          >
            <Input value={email} disabled />
          </FormField>

          <FormField label="Name" error={errors.full_name?.message}>
            <Input {...register("full_name")} placeholder="Alex Johnson" autoComplete="name" />
          </FormField>

          <FormField
            label="Student stage"
            error={errors.student_stage?.message}
            hint="Changing it here changes it everywhere Sevri describes you."
          >
            <Select {...register("student_stage")} hasError={Boolean(errors.student_stage?.message)}>
              {studentStageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Primary project goal" error={errors.project_goal?.message}>
            <Select {...register("project_goal")} hasError={Boolean(errors.project_goal?.message)}>
              {projectGoalOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

        </div>

        {info ? <Alert tone="success">{info}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>

          <p className="text-sm text-ink-soft">
            {isDirty ? "You have unsaved changes." : "Your settings are up to date."}
          </p>
        </div>
      </form>
    </Card>
  );
}
