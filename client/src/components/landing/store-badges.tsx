/* eslint-disable @next/next/no-img-element */
const badges = [
  {
    src: "/egov/badge-appstore.png",
    alt: "Download on the App Store",
    href: "https://apps.apple.com/us/app/egovph/id6447682225",
  },
  {
    src: "/egov/badge-googleplay.png",
    alt: "Get it on Google Play",
    href: "https://play.google.com/store/apps/details?id=egov.app&hl=en",
  },
  {
    src: "/egov/badge-appgallery.png",
    alt: "Explore it on AppGallery",
    href: "https://appgallery.huawei.com/#/app/C111221319",
  },
];

export function StoreBadges() {
  return (
    <>
      {badges.map((b) => (
        <a
          key={b.alt}
          href={b.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={b.alt}
          className="transition-opacity hover:opacity-80 active:opacity-60"
        >
          <img src={b.src} alt={b.alt} className="h-12 w-auto" />
        </a>
      ))}
    </>
  );
}
