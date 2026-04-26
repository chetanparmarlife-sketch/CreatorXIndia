import { Resend } from "resend";

function isProductionEnvironment(): boolean {
  const env = process.env.ENV ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV;
  return env === "production";
}

function logOtpFallback(email: string, otp: string): void {
  if (isProductionEnvironment()) {
    return;
  }

  console.log(`OTP for ${email}: ${otp}`);
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set; falling back to OTP console log.");
    logOtpFallback(email, otp);
    return;
  }

  const resend = new Resend(apiKey);
  try {
    const { data, error } = await resend.emails.send({
      from: "CreatorX <otp@creator-x.club>",
      to: email,
      subject: `${otp} is your CreatorX OTP`,
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;">
          <h2 style="color:#6366f1;">CreatorX</h2>
          <p>Your one-time login code is:</p>
          <h1 style="letter-spacing:8px;color:#111;font-size:40px;">${otp}</h1>
          <p style="color:#666;">This code expires in 10 minutes.</p>
          <p style="color:#666;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend OTP email failed:", error);
      logOtpFallback(email, otp);
      if (isProductionEnvironment()) {
        throw new Error("OTP email delivery failed");
      }
      return;
    }

    console.log("OTP email sent:", { email, id: data?.id });
  } catch (error) {
    if (!(error instanceof Error && error.message === "OTP email delivery failed")) {
      console.error("Resend OTP email failed:", error);
    }
    logOtpFallback(email, otp);
    if (isProductionEnvironment()) {
      throw error;
    }
  }
}
