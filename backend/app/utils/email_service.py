import os
import smtplib
import logging
from email.message import EmailMessage
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger("attendance.email")

IST = timezone(timedelta(hours=5, minutes=30), name="IST")

def is_smtp_configured() -> bool:
    """Check if SMTP credentials are provided in the environment."""
    host = os.getenv("SMTP_HOST", "").strip()
    user = os.getenv("SMTP_USER", "").strip()
    return bool(host and user)

def send_otp_email(
    to_email: str,
    student_name: str,
    otp_code: str,
    session_id: int,
    venue_name: str = "Francis Xavier Engineering College",
    expires_in_seconds: int = 30
) -> bool:
    """
    Send attendance OTP email to a verified student.
    Returns True if sent successfully, False otherwise.
    """
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("SMTP_FROM_EMAIL", user or "noreply@attendance.local").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")
    use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() in ("true", "1", "yes") or port == 465

    if not host or not user:
        logger.info(f"SMTP not configured. Skipping email delivery to {to_email}. (OTP: {otp_code})")
        return False

    now_ist = datetime.now(IST).strftime("%d-%m-%Y, %I:%M:%S %p")

    msg = EmailMessage()
    msg["Subject"] = f"Your Attendance OTP: {otp_code} (Session #{session_id})"
    msg["From"] = from_email
    msg["To"] = to_email

    # Plain text version
    msg.set_content(f"""Hello {student_name},

Your physical location has been verified inside {venue_name}.
Here is your dynamic 6-digit passcode to mark attendance for Session #{session_id}:

========================
OTP CODE: {otp_code}
========================

Venue: {venue_name}
Timestamp: {now_ist} IST

Please enter this OTP in your student dashboard to submit your attendance.

If you did not request this, please contact the administrator.
""")

    # HTML version
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Attendance OTP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="520" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e4e4e7; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 28px 20px 28px; background-color: #09090b; color: #ffffff; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #a1a1aa; margin-bottom: 6px;">
                Attendance Verification System
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                {venue_name}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <div style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 999px; color: #065f46; font-size: 12px; font-weight: 600; margin-bottom: 18px;">
                ✓ Location Verified Inside Venue
              </div>

              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #3f3f46;">
                Hello <strong>{student_name}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #71717a;">
                Your device was detected inside the attendance zone. Use the 6-digit passcode below to record your check-in for <strong>Session #{session_id}</strong>:
              </p>

              <!-- OTP Display Box -->
              <div style="background-color: #09090b; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #a1a1aa; font-weight: 600; margin-bottom: 8px;">
                  Your Attendance Passcode
                </div>
                <div style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #ffffff; font-family: 'Courier New', Courier, monospace;">
                  {otp_code}
                </div>
              </div>

              <!-- Metadata Table -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border: 1px solid #f4f4f5; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; font-family: monospace;">
                <tr>
                  <td style="padding: 4px 0; color: #71717a;">Session:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #18181b;">Session #{session_id:02d}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #71717a;">Time (IST):</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #18181b;">{now_ist}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #71717a;">Location:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #18181b;">{venue_name}</td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                Please submit this OTP on your registered device screen to complete attendance marking.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 28px; background-color: #fafafa; border-top: 1px solid #f4f4f5; text-align: center; font-size: 11px; color: #a1a1aa;">
              Automated OTP Attendance System • Secure Geofenced Check-in
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    msg.add_alternative(html_content, subtype="html")

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=10) as server:
                if password:
                    server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=10) as server:
                if use_tls:
                    server.starttls()
                if password:
                    server.login(user, password)
                server.send_message(msg)
        logger.info(f"Successfully sent OTP email to {to_email} for Session #{session_id}.")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {str(e)}")
        return False
