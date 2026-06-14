import { Resend } from 'resend';

const FROM = 'Octara <onboarding@resend.dev>';

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
  userName: string
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'Email service not configured' };
  const resend = new Resend(key);
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: 'Reset your Octara password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
          <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Reset your password</h2>
            <p style="color:#64748b;margin:0 0 24px;font-size:14px;">Hi ${userName}, click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Reset Password</a>
            <p style="color:#94a3b8;margin:24px 0 0;font-size:12px;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">Or copy this link: <br><span style="word-break:break-all;">${resetUrl}</span></p>
          </div>
        </div>
      `,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Email send failed' };
  }
}
