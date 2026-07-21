/* eslint-disable @next/next/no-img-element */
import { Globe, Share2, Mail } from "lucide-react";

const columns = [
  {
    heading: "Platform",
    links: ["Features", "How It Works", "Security", "Download"],
  },
  {
    heading: "Resources",
    links: ["News", "FAQ", "Developers", "Help Center"],
  },
  {
    heading: "Legal",
    links: ["Privacy Policy", "Terms of Service", "Data Privacy Act"],
  },
];

export function Footer() {
  return (
    <footer className="bg-[#111111] text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-10">
        <div className="grid grid-cols-2 md:grid-cols-[auto_1fr_1fr_1fr] gap-x-8 gap-y-10 items-start">
          <div className="col-span-2 md:col-span-1 flex items-start gap-3">
            <img
              src="/egov/seal.png"
              alt="Republika ng Pilipinas"
              className="flex-shrink-0 w-[160px] h-[176px] object-contain"
            />
            <div className="flex flex-col gap-2 max-w-[200px]">
              <img
                src="/egov/logo.png"
                alt="eGovPH"
                className="h-7 w-auto object-contain object-left brightness-0 invert"
              />
              <p className="text-white/80 text-[0.813rem] leading-snug mt-1">
                The official digital platform of the Philippine government for
                citizen services.
              </p>
              <p className="text-white/40 text-[0.75rem] leading-snug mt-1">
                Department of Information and Communications Technology (DICT)
              </p>
              <div className="flex gap-3 mt-3">
                {[Globe, Share2, Mail].map((Icon, i) => (
                  <span
                    key={i}
                    className="w-8 h-8 rounded-full bg-white/10 grid place-items-center hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    <Icon size={14} />
                  </span>
                ))}
              </div>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-[0.813rem] text-white/50 uppercase tracking-wider mb-4">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <span className="text-[0.875rem] text-white/80 hover:text-white transition-colors cursor-pointer">
                      {l}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row justify-between gap-2 text-[0.75rem] text-white/40">
          <span>Republika ng Pilipinas</span>
          <span>© {new Date().getFullYear()} eGovPH. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
