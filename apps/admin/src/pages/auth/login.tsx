import { OtpLogin } from "@creatorx/ui";

const ADMIN_ROLES = ["admin", "admin_ops", "admin_support", "admin_finance", "admin_readonly"] as const;

export default function AdminLoginPage() {
  return (
    <OtpLogin
      headline="CreatorX Admin"
      subline="Internal operations console."
      accentColor="#e11d48"
      allowedRoles={[...ADMIN_ROLES]}
      roleError="Access denied. Admin accounts only."
      successPath="/dashboard"
      backgroundClassName="bg-[#0a0a0a]"
    />
  );
}
