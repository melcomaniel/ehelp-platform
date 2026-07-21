export function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`px-4 sm:px-6 lg:px-8 py-16 md:py-24 ${className}`}>
      <div className="max-w-7xl mx-auto">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  highlight,
  description,
}: {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
}) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-16">
      <span className="inline-block text-[#0040E7] text-[0.813rem] tracking-wider uppercase mb-4">
        {eyebrow}
      </span>
      <h2 className="text-[2rem] md:text-[2.5rem] tracking-tight text-[#1a1a2e] mb-4">
        {title} <span className="text-[#0040E7]">{highlight}</span>
      </h2>
      <p className="text-[#64748b] text-[1.063rem] leading-relaxed">{description}</p>
    </div>
  );
}
