"use client";

export function InstallationAdminActions({
  status,
  installationId,
  blockAction,
  unblockAction
}: {
  status: string;
  installationId: string;
  blockAction: (formData: FormData) => Promise<void>;
  unblockAction: (formData: FormData) => Promise<void>;
}) {
  const isBlocked = status === "BLOCKED";
  const action = isBlocked ? unblockAction : blockAction;
  const label = isBlocked ? "Unblock installation" : "Block installation";
  const confirmMessage = isBlocked
    ? "Unblock this installation and allow it to refresh again?"
    : "Block this installation and stop it from refreshing?";

  if (!isBlocked && status !== "ACTIVE") {
    return null;
  }

  return (
    <form
      action={action}
      style={{ marginTop: 16 }}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={installationId} />
      <button className={isBlocked ? "btn secondary" : "btn danger"} type="submit">
        {label}
      </button>
    </form>
  );
}
