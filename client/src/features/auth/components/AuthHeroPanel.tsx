const HERO_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida/ALJJyrDIlaBH3vOlFYpi6B99S0yJsKE48itdqq2SOda8uZGEI1MVLUL-kxGI3Kt_LgR-M3F-IjP-YP4Imovvu7Ii9oeIamKbaIGkV4jciSjCu_iqe_EuBIMZBFJ3vVu68rhPvqQop-5MZ9JjhVOzIkhdonfqCKvkOWWCzWcjDBvhligaV3fXMsY6bu7o_zxqwZI5G5jXf4bUBCgpZlbtbY1x_ZI61rXrl0nmJ1P0nzfrOiNW9EkCjI0C1B1HsdlJ6UpSG_JSRw';

const ELENA_AVATAR_URL =
  'https://lh3.googleusercontent.com/aida/ALJJyrDnOJv6dSmIskpR0ZRSOlAmxVyl71Z0uLs9fHuIoK1lFTQsSP5N8vSHmL8OQQEe7Afj3NDgN2NKZ1EkueIFfV48lomPGXZMsR5CCUuvGZkZQhgd0lYg92ra6e5bt1E92O0ClEtMz6T66oJjJQ-cAlJlDBxuwgKy4lv2Hm9zgqKnXpTWdalHDmqjxaOpALiSFkdKYs_6qWhCcFBitaERQ8x04teqDqjY6kfgeNgsUUUypjSJIWKIUiTR0Zv9OI0M';

interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatarUrl?: string;
  initials?: string;
  desktopOnly?: boolean;
}

const TESTIMONIALS: TestimonialItem[] = [
  {
    id: 'elena',
    name: 'Elena Rostova',
    role: 'VP Legal Ops · Acme Global',
    quote:
      '"Every clause answer links directly to the exact contract page. Our audit prep time dropped by 70%."',
    avatarUrl: ELENA_AVATAR_URL,
  },
  {
    id: 'marcus',
    name: 'Marcus Johnson',
    role: 'Head of FP&A · Northstar',
    quote:
      '"Zero hallucinations across our Q4 EBITDA models. It cites the exact sheet and row every time."',
    initials: 'MJ',
    desktopOnly: true,
  },
];

/**
 * Editorial split-screen visual column with floating customer testimonials.
 */
export function AuthHeroPanel() {
  return (
    <aside aria-label="Customer Testimonials" className="hidden md:block flex-1 relative p-20">
      <div className="relative w-full h-full min-h-[calc(100vh-40px)] rounded-lg overflow-hidden border border-outline">
        <img
          src={HERO_IMAGE_URL}
          alt="DocuMind editorial architectural workspace"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-pitch/65 via-pitch/15 to-transparent" />

        <div className="absolute bottom-32 left-20 right-20 grid grid-cols-1 xl:grid-cols-2 gap-15">
          {TESTIMONIALS.map((item) => (
            <div
              key={item.id}
              className={
                item.desktopOnly
                  ? 'hidden xl:flex rounded-card bg-surface/95 backdrop-blur-md border border-outline p-20 items-start gap-15 shadow-sm'
                  : 'rounded-card bg-surface/95 backdrop-blur-md border border-outline p-20 flex items-start gap-15 shadow-sm'
              }
            >
              {item.avatarUrl ? (
                <img
                  src={item.avatarUrl}
                  alt={item.name}
                  className="w-10 h-10 rounded-md object-cover shrink-0 border border-outline"
                />
              ) : (
                <span className="w-10 h-10 rounded-md bg-secondary text-on-secondary flex items-center justify-center font-t03 text-t03 shrink-0">
                  {item.initials}
                </span>
              )}
              <div className="flex flex-col gap-1 min-w-0">
                <div className="font-t04 text-t04-medium text-on-surface">{item.name}</div>
                <div className="font-mono text-mono-sm text-on-surface-variant">{item.role}</div>
                <p className="font-t05 text-t05 text-on-surface mt-1 text-pretty">
                  {item.quote}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
