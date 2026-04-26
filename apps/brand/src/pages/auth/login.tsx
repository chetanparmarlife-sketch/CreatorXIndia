import { OtpLogin } from "@creatorx/ui";

export default function BrandLoginPage() {
  return (
    <OtpLogin
      headline="Welcome to CreatorX for Brands"
      subline="Manage campaigns, discover creators, track ROI."
      accentColor="#7c3aed"
      allowedRoles={["brand"]}
      roleError="This portal is for brand accounts only."
      successPath="/dashboard"
    />
  );
}
