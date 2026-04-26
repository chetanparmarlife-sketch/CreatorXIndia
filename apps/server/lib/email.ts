import { Resend } from "resend";

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`OTP for ${email}: ${otp}`);
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
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
}
