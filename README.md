# OASISSHOLAR

OASISSCHOLARS is a new scholarship support website scaffold with four pages:

- `index.html` — Homepage
- `opportunities.html` — Scholarship opportunities page
- `about.html` — About the project and mission
- `contact.html` — Contact form and contact details

The site includes responsive styles in `styles.css` and simple navigation behavior in `script.js`.

Owner accounts, scholarship posts, images, and documents are handled with Supabase. If Supabase credentials are not configured yet, the owner tools automatically use browser local storage for demos so development can continue without Firestore billing. See `SUPABASE_SETUP.md` for the database, authentication, and storage setup.

## Security

See `SECURITY.md` for the recommended security implementation plan, including HTTPS, encrypted storage, authentication controls, infrastructure protections, and monitoring.
