// Google Analytics for the introduction page only (constitution I, v1.4.0). The app under app/
// never gets it. The measurement ID comes from the GA_MEASUREMENT_ID build variable; without it
// the page is built with no analytics at all.
import type { Plugin } from "vite";

const ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

const NOTICE =
  '<p class="analytics-notice">このページ（紹介ページ）では、閲覧状況を知るために Google アナリティクスを使っています。' +
  "アプリ本体では使っていません。" +
  '<a href="https://policies.google.com/technologies/partner-sites?hl=ja" target="_blank" rel="noopener noreferrer">Google によるデータの使用について</a></p>';

/** Adds the tag and a notice to the introduction page's HTML. */
export const injectAnalytics = (html: string, id: string): string => {
  if (!ID_PATTERN.test(id)) throw new Error(`GA_MEASUREMENT_ID is not a GA4 ID: ${id}`);
  const tag = `<script>
      // Installed apps are sent on to app/ (see the script above) and are not measured.
      if (!(matchMedia("(display-mode: standalone)").matches || navigator.standalone === true)) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
          dataLayer.push(arguments);
        };
        gtag("js", new Date());
        gtag("config", "${id}");
        var s = document.createElement("script");
        s.async = true;
        s.src = "https://www.googletagmanager.com/gtag/js?id=${id}";
        document.head.appendChild(s);
        document.addEventListener("click", function (e) {
          var a = e.target instanceof Element && e.target.closest("a.cta");
          if (a) gtag("event", "open_app", { link_text: a.textContent.trim() });
        });
      }
    </script>
  </head>`;
  if (!html.includes("</head>") || !html.includes("</footer>"))
    throw new Error("the introduction page has no </head> or </footer>");
  return html.replace("</head>", tag).replace("</footer>", `${NOTICE}</footer>`);
};

export const landingAnalytics = (id: string | undefined): Plugin => ({
  name: "landing-analytics",
  enforce: "post",
  transformIndexHtml: {
    order: "post",
    handler: (html, ctx) => (id && ctx.path === "/index.html" ? injectAnalytics(html, id) : html),
  },
});
