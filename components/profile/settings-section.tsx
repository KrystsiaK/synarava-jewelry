"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

import {
  updateNameAction,
  updatePasswordAction,
  revokeAllSessionsAction,
  type ProfileActionState,
} from "@/app/profile/actions";

const ease = [0.22, 1, 0.36, 1] as const;

function FieldInput({
  id,
  name,
  label,
  type = "text",
  defaultValue,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="label-caps block text-foreground/50">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required
        className="w-full border border-stroke bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-foreground/50 focus:bg-foreground/[0.02]"
      />
    </div>
  );
}

function SubmitBtn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="label-caps border border-foreground/60 px-5 py-2.5 text-sm transition-colors hover:border-couture-red hover:bg-couture-red hover:text-linen disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionFeedback({ state }: { state: ProfileActionState }) {
  return (
    <AnimatePresence mode="wait">
      {(state.error || state.success) && (
        <motion.p
          key={state.error ?? state.success}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease }}
          className={`text-sm ${state.error ? "text-couture-red" : "text-foreground/60"}`}
        >
          {state.error ?? state.success}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

type Props = {
  userName: string | null;
  sessionCount: number;
};

export function SettingsSection({ userName, sessionCount }: Props) {
  const [nameState, nameAction] = useActionState<ProfileActionState, FormData>(updateNameAction, {});
  const [pwdState, pwdAction] = useActionState<ProfileActionState, FormData>(updatePasswordAction, {});
  const [sessionState, sessionAction] = useActionState<ProfileActionState, FormData>(revokeAllSessionsAction, {});

  return (
    <div className="space-y-12">
      {/* Name */}
      <section className="relative border border-stroke p-6 md:p-8">
        <div className="absolute left-0 top-0 h-full w-0.5 bg-foreground/8" />
        <h3 className="font-serif mb-6 text-xl">Display name</h3>
        <form action={nameAction} className="space-y-5">
          <FieldInput
            id="name"
            name="name"
            label="Name"
            defaultValue={userName ?? ""}
            autoComplete="name"
          />
          <div className="flex items-center gap-4">
            <SubmitBtn label="Update name" pendingLabel="Saving…" />
            <ActionFeedback state={nameState} />
          </div>
        </form>
      </section>

      {/* Password */}
      <section className="relative border border-stroke p-6 md:p-8">
        <div className="absolute left-0 top-0 h-full w-0.5 bg-foreground/8" />
        <h3 className="font-serif mb-1 text-xl">Change password</h3>
        <p className="mb-6 text-sm text-foreground/45">
          All active sessions will be invalidated after a password change.
        </p>
        <form action={pwdAction} className="space-y-5">
          <FieldInput
            id="currentPassword"
            name="currentPassword"
            type="password"
            label="Current password"
            autoComplete="current-password"
          />
          <FieldInput
            id="nextPassword"
            name="nextPassword"
            type="password"
            label="New password"
            autoComplete="new-password"
          />
          <FieldInput
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm new password"
            autoComplete="new-password"
          />
          <div className="flex items-center gap-4">
            <SubmitBtn label="Change password" pendingLabel="Updating…" />
            <ActionFeedback state={pwdState} />
          </div>
        </form>
      </section>

      {/* Sessions */}
      <section className="relative border border-stroke p-6 md:p-8">
        <div className="absolute left-0 top-0 h-full w-0.5 bg-couture-red/30" />
        <h3 className="font-serif mb-1 text-xl">Active sessions</h3>
        <p className="mb-6 text-sm text-foreground/45">
          {sessionCount} active{" "}
          {sessionCount === 1 ? "session" : "sessions"} on your account. Revoking all sessions
          will sign you out from every device.
        </p>
        <form action={sessionAction}>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="label-caps border border-couture-red/40 px-5 py-2.5 text-sm text-couture-red transition-colors hover:bg-couture-red hover:text-linen"
            >
              Revoke all sessions
            </button>
            <ActionFeedback state={sessionState} />
          </div>
        </form>
      </section>
    </div>
  );
}
