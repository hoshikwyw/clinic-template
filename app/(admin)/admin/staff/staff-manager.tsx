"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  setStaffRole,
  addStaffByEmail,
  type StaffMember,
  type SetRoleResult,
} from "@modules/staff";
import { Button } from "@ui/primitives/button";
import { Input } from "@ui/primitives/input";

const ROLES = ["admin", "doctor", "staff", "patient"] as const;

function roleLabelKey(role: string) {
  if (role === "admin") return "roleAdmin";
  if (role === "doctor") return "roleDoctor";
  if (role === "staff") return "roleStaff";
  return "rolePatient";
}

const selectCls =
  "min-h-9 rounded-md border border-input bg-transparent px-2 text-sm";

export function StaffManager({
  staff,
  currentUserId,
}: {
  staff: StaffMember[];
  currentUserId: string;
}) {
  const t = useTranslations("adminStaff");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [feedback, setFeedback] = React.useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  const [email, setEmail] = React.useState("");
  const [addRole, setAddRole] = React.useState("staff");

  function errMsg(error?: string) {
    switch (error) {
      case "not-found":
        return t("errNotFound");
      case "self-demote":
        return t("errSelfDemote");
      case "invalid-role":
        return t("errInvalid");
      default:
        return t("errFailed");
    }
  }

  function handle(res: SetRoleResult, okMsg: string) {
    if (res.ok) {
      setFeedback({ ok: true, msg: okMsg });
      router.refresh();
    } else {
      setFeedback({ ok: false, msg: errMsg(res.error) });
    }
  }

  function changeRole(userId: string, role: string) {
    startTransition(async () =>
      handle(await setStaffRole(userId, role), t("updated"))
    );
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const res = await addStaffByEmail(email, addRole);
      handle(res, t("added"));
      if (res.ok) setEmail("");
    });
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <p
          className={
            feedback.ok
              ? "text-sm font-medium text-primary"
              : "text-sm font-medium text-destructive"
          }
        >
          {feedback.msg}
        </p>
      )}

      <form
        onSubmit={add}
        className="space-y-3 rounded-xl border border-border p-4"
      >
        <p className="text-sm font-medium">{t("addTitle")}</p>
        <div className="flex flex-wrap gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="max-w-xs"
            required
          />
          <select
            value={addRole}
            onChange={(e) => setAddRole(e.target.value)}
            className={selectCls}
          >
            {ROLES.filter((r) => r !== "patient").map((r) => (
              <option key={r} value={r}>
                {t(roleLabelKey(r))}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={pending}>
            {t("add")}
          </Button>
        </div>
      </form>

      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="space-y-2">
          {staff.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <div className="text-sm">
                <div className="font-medium">
                  {m.fullName ?? m.email}{" "}
                  {m.id === currentUserId && (
                    <span className="text-muted-foreground">{t("you")}</span>
                  )}
                </div>
                <div className="text-muted-foreground">{m.email}</div>
              </div>
              <select
                defaultValue={m.role}
                disabled={pending || m.id === currentUserId}
                onChange={(e) => changeRole(m.id, e.target.value)}
                className={selectCls}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(roleLabelKey(r))}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
