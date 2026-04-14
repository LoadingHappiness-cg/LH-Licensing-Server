"use client";

export function InstallationAdminActions({
  status,
  licenseStatus,
  installationId,
  blockAction,
  unblockAction,
  releaseAction
}: {
  status: string;
  licenseStatus: string | null;
  installationId: string;
  blockAction: (formData: FormData) => Promise<void>;
  unblockAction: (formData: FormData) => Promise<void>;
  releaseAction: (formData: FormData) => Promise<void>;
}) {
  const isBlocked = status === "BLOCKED";
  const canRelease = status === "ACTIVE" && licenseStatus === "REVOKED";
  const action = isBlocked ? unblockAction : blockAction;
  const label = isBlocked ? "Unblock installation" : "Block installation";
  const confirmMessage = isBlocked
    ? "Unblock this installation and allow it to refresh again?"
    : "Block this installation and stop it from refreshing?";

  if (!isBlocked && status !== "ACTIVE") {
    return null;
  }

  return (
    <>
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

      {canRelease ? (
        <form
          action={releaseAction}
          style={{ marginTop: 12 }}
          onSubmit={(event) => {
            if (!window.confirm("Release this installation from the revoked license?")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={installationId} />
          <button className="btn secondary" type="submit">
            Release installation
          </button>
        </form>
      ) : null}
    </>
  );
}
