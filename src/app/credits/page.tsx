import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const metadata: Metadata = { title: "Credits · Signal Kit" };

/** Attribution for the media Signal Kit ships: homepage gameplay, alert art and sounds. */
export default function CreditsPage() {
  return (
    <div className="sk-app flex flex-1 justify-center px-5 sm:px-8">
      <div className="flex w-full max-w-3xl flex-col">
        <SiteHeader />
        <main className="flex flex-col gap-10 pt-12 text-sm leading-[22px] text-(--text-2)">
          <h1 className="sk-brand text-[36px] leading-10 font-semibold tracking-[-0.03em] text-(--text)">Credits</h1>
          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-(--text)">Gameplay on the homepage</h2>
            <p>
              Parkour game footage by{" "}
              <a href="https://elements.envato.com/gameplay-in-first-person-parkour-videogame-in-indu-P3843DA" className="text-(--text) underline-offset-2 hover:underline">
                Pressmaster
              </a>
              , licensed through Envato Elements. Signal Kit overlays, chat and alerts on top are samples.
            </p>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-(--text)">Alert art</h2>
            <ul className="flex flex-col">
              <li className="border-t border-(--line) py-3">
                <a href="https://googlefonts.github.io/noto-emoji-animation/" className="text-(--text) underline-offset-2 hover:underline">
                  Noto Emoji animations
                </a>{" "}
                by Google,{" "}
                <a href="https://creativecommons.org/licenses/by/4.0/" className="underline-offset-2 hover:underline">
                  CC BY 4.0
                </a>
                .
              </li>
              <li className="border-t border-(--line) py-3">
                <a href="https://github.com/microsoft/fluentui-emoji" className="text-(--text) underline-offset-2 hover:underline">
                  Fluent Emoji
                </a>{" "}
                by Microsoft, MIT license.
              </li>
              <li className="border-t border-(--line) py-3">Signal Kit&apos;s own alert icons and default sounds.</li>
            </ul>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-(--text)">Alert sounds</h2>
            <p>
              CC0 (public domain) sound effects by{" "}
              <a href="https://kenney.nl/assets" className="text-(--text) underline-offset-2 hover:underline">
                Kenney
              </a>
              ,{" "}
              <a href="https://opengameart.org/content/512-sound-effects-8-bit-style" className="text-(--text) underline-offset-2 hover:underline">
                Juhani Junkala
              </a>{" "}
              and{" "}
              <a href="https://opengameart.org/content/magic-spell-sfx" className="text-(--text) underline-offset-2 hover:underline">
                JaggedStone
              </a>
              .
            </p>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-(--text)">Fonts and platform marks</h2>
            <p>Overlay fonts are served by Google Fonts under the SIL Open Font License. Twitch, YouTube and X marks are trademarks of their owners, used to show which platform an event came from.</p>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
