import { OtpLogin } from "@creatorx/ui";

export default function CreatorLoginPage() {
  return (
    <OtpLogin
      headline="Welcome, Creator"
      subline="Log in to manage your campaigns and earnings."
      accentColor="#6366f1"
      allowedRoles={["creator"]}
      roleError="This portal is for creators only."
      successPath="/home"
      signupHref="/auth/signup"
    />
  );
}
