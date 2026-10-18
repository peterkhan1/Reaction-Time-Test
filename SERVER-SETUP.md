# How this site is served (static site, no framework)

This is plain HTML + CSS + JS. There is no build step, no Node, no database. The server only has to hand the files over.

## Folder layout (upload everything, keep this structure)

```
index.html  cps-test.html  aim-trainer.html  typing-test.html  memory-test.html
average-reaction-time.html  methodology.html  about.html  contact.html  privacy.html  terms.html  404.html
favicon.svg  site.webmanifest  robots.txt  sitemap.xml  .htaccess
assets/css  assets/js  assets/fonts  assets/img  assets/og
```
Upload into `public_html/` (cPanel) or your web root. Do not put the files in a sub-folder unless you also change the `/` paths in `404.html`, `site.webmanifest` and the canonical/OG URLs.

## 1. Replace the placeholders
In VS Code press **Ctrl+Shift+H** (Replace in Files):
- `example.com` -> your real domain (for example `reactiontest.com`). This covers canonical links, Open Graph, JSON-LD, sitemap, robots.
- `hello@example.com` -> your real email (contact page, privacy, terms).

## 2. Apache / cPanel / LiteSpeed (most "old style" hosts)
The included `.htaccess` already gives you: custom 404, gzip, 1-year caching for CSS/JS/fonts (files carry `?v=hash` so updates still show), no caching for HTML, security headers incl. a strict Content-Security-Policy.
After SSL (HTTPS) is active, uncomment the HTTPS + www redirect block at the top of `.htaccess`.

## 3. Nginx (if your server uses it)
```
server {
  server_name example.com;
  root /var/www/reaction-test;
  index index.html;
  error_page 404 /404.html;
  gzip on; gzip_types text/css application/javascript image/svg+xml application/json;
  location ~* \.(css|js|woff2)$ { expires 1y; add_header Cache-Control "public, immutable"; }
  location ~* \.html$ { add_header Cache-Control "no-cache"; }
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" always;
}
```

## 4. Why a page can show "404" or look unstyled
- You opened or hosted only `index.html`. All files must be uploaded together, with the `assets/` folder.
- A preview host (Next.js style, some "live preview" tools) only serves some files. Use a real static host or cPanel.
- Opening with `file://` works for everything except the share button and wake-lock (browser limits).

## 5. Google (SEO) setup, after launch
1. Add the site to **Google Search Console** and submit `https://yourdomain/sitemap.xml`.
2. Use "URL inspection" -> "Request indexing" for the home page and each tool page.
3. Add the site to **Bing Webmaster Tools** (import from Search Console).
4. Check https://search.google.com/test/rich-results on a tool page (WebApplication + Breadcrumb data).
5. Check speed on PageSpeed Insights. The site has no third-party requests, so scores should be high.
Each page already has a unique title, description, canonical URL, Open Graph/Twitter image, and structured data.

## 6. If you later add analytics or ads
Update `privacy.html` first (it currently says there are no trackers and no cookies), and relax the Content-Security-Policy in `.htaccess` for the provider's domain.
