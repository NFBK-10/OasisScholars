# OASISSCHOLARS Security Plan

This static website is currently a front-end prototype. The security measures below describe what must be implemented when you build the backend, deploy the site, and store user data.

## 1. Data Encryption (Protecting Information)

- **SSL/TLS Certificate (HTTPS):** Serve the website only over HTTPS with a valid SSL/TLS certificate. This encrypts all browser-server traffic and protects credentials, personal information, and form submissions from interception.
- **Database Encryption (Data at Rest):** Encrypt sensitive user data stored in the database. Store only hashed passwords using strong algorithms such as `bcrypt` or `Argon2`.
- **Encrypted Backups:** Ensure backups are encrypted and stored separately from the main environment.

## 2. Access Control & Authentication

- **Multi-Factor Authentication (MFA):** Implement MFA for user and admin accounts using SMS, email, or authenticator apps.
- **Secure Session Management:** Store session tokens in secure cookies with the following flags:
  - `Secure`
  - `HttpOnly`
  - `SameSite=Strict` or `SameSite=Lax`
- **Strong Password Policies:** Enforce strong password requirements and prevent reuse of weak passwords.

## 3. Infrastructure & Edge Protection

- **Web Application Firewall (WAF):** Use a WAF service such as Cloudflare, AWS WAF, or a similar provider to block malicious traffic and protect against SQL injection, XSS, bot attacks, and other common web threats.
- **DDoS Protection:** Use DDoS protection to mitigate traffic floods and keep the site available during attack attempts.

## 4. Code & Application Security

- **Input Sanitization and Validation:** Validate and sanitize all user input on the server. Do not trust client-side validation alone. This protects against SQL injection and cross-site scripting (XSS).
- **Secure File Upload Controls:** If document upload is added, constrain uploads to safe file types (for example `pdf`, `jpg`, `jpeg`, `png`), enforce maximum file size, and scan all uploads for malware.
- **Avoid Inline Scripts:** Keep scripts in external files and avoid inline JavaScript to support strong Content Security Policy enforcement.

## 5. Monitoring & Maintenance

- **Regular Security Audits:** Review code, dependencies, and infrastructure regularly for vulnerabilities.
- **Dependency Updates:** Keep frameworks and third-party libraries up to date to avoid known security issues.
- **Automated Backups:** Implement automated, encrypted backups and a recovery plan in case of attack or data loss.

## Notes for Implementation

This static website currently contains only the front-end. To fully apply the security model above, a backend system and hosting infrastructure are required.

- Use a server platform that supports HTTPS and response headers.
- Use a secure database and storage service for documents and user records.
- Implement authentication and session management in a backend technology (Node.js, Python, PHP, etc.).
