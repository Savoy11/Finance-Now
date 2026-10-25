# Fund issuer permission requests — drafts, 2026-10-25

**Drafts for the owner to review, edit and send when preparing to launch.** Nothing here has been
sent, and no issuer has been contacted. Sending is the owner's act. They are parked with the other
provider enquiries under T-425 (D163), and recorded by D165.

## Why they exist

The Fund Figures Check (T-440) asks for each fund's current yield, or net assets, read from the
issuer's own page. Yields change, so a figure read once goes stale. For seven issuers the terms of
use bar reading their pages by software without written permission (readings in
`site-terms-results.json`, 2026-10-20; rulings D141 and D149). So their 33 figures are read by
hand, and a ruling of the owner's cannot change that: the permission is the site's to give (D149).
Before launch all use is personal (D96), but a personal-use rule never reopens a ban on automated
access.

| Issuer | Funds in the catalog read by hand | What the terms require |
|---|---|---|
| BlackRock (iShares) | AGG, EFA, EMB, EWJ, HEFA, HYG, IAGG, IAI, ICLN, IEF, IEI, IHI, ITA, ITB, IVV, IWM, IYT, LQD, MUB, SGOV, SHY, SOXX, TIP, TLT | No "robot, spider, intelligent agent, other automatic device" without BlackRock's permission; public or commercial use needs written permission |
| Invesco | BKLN, QQQ, RSP | Personal non-commercial or internal business use; commercial use needs "express prior written consent"; robots and data extraction barred |
| JPMorgan | JEPI, JEPQ | No robots "without our prior expressed written permission"; copying needs prior written consent |
| Dodge & Cox | DODGX | Robots, scrapers, AI and other automated means barred; other use only "as expressly authorized by Dodge & Cox in writing" |
| Fidelity | FXAIX | Automated access tools need written approval; commercial use needs express written consent |
| PIMCO | PIMIX | Scraping and data mining barred; use beyond the terms needs express written consent |
| USCF | CPER | No automated systems (search engines excepted); copying needs prior written authorisation |

**Where to send.** Only PIMCO's terms name a contact: PIMCO, 650 Newport Center Drive, Newport
Beach, CA 92660, 800-387-4626. For the others, use the contact the issuer's own site gives (its
legal, permissions or media page). No address here was guessed.

**Before sending:** the same cautions as the 2026-09-20 drafts. A request discloses the project;
scale and commercial posture are still open (D21); a reply is evidence, not a licence; none of this
is legal advice. The company is not formed yet, so sign with your own name.

---

## The request (one per issuer)

Fill in the issuer's name and its funds from the table above.

> **Subject:** Permission to read and show [ISSUER] fund figures
>
> Hello,
>
> I'm building Finance Now, a financial information website, which I plan to run through a
> company now being formed. Its fund pages show a few published facts for each fund, with a credit
> and a link to the issuer's own page. For [ISSUER], these funds: [FUNDS].
>
> The figures I use are each fund's current yield (or, for some funds, its net assets) and the
> date your page gives for it. They change over time, so I'd like to keep them current. Your terms
> of use ask for written permission before software reads your site, and before content is used
> publicly, so before the site opens to other visitors I'd like to ask:
>
> 1. May a script read these funds' pages on your site, about once a week, to collect only those
>    figures and their dates? It would identify itself, follow your robots.txt, and keep no
>    cookies.
> 2. May the site show those figures publicly, with a credit and a link to your page? If you
>    prefer different wording for the credit, what would you like?
> 3. If you publish these figures another way you'd rather we use (a data file or feed), where is
>    it, and on what terms?
>
> The site is not public yet, and until I hear from you the figures are typed in by hand from your
> pages.
>
> Thank you,
> [Your name]

---

## After a reply

Record it in this folder, dated, and on T-440 (and T-425). A "yes" in writing lets that issuer's
site be ruled Allowed for the pre-fill (`npm run site-terms -- --rule allowed=<site>`), with the
reply cited in the ruling's note. A "no", or no answer, leaves its figures hand-read.
