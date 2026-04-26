export function NotAuthorizedPage({ message = "You don't have access to this page." }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6" data-testid="page-not-authorized">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold">{message}</h1>
      </div>
    </div>
  );
}
