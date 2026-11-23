# Subscription conversion benchmarks for Health & Fitness apps, and the evidence on free trials, trial length and plan/price structure

Context: Tidemark is a private, account-free iPhone weight tracker with a free core. Plus costs £3.99/month, £19.99/year with a 7-day free trial, or £49.99 lifetime, sold in the UK and non-EU countries. That makes it a freemium, low-price-tier app. The annual plan is about 58% off 12 x monthly (£47.88) and the lifetime price is 2.5x annual.

How to read the sources:
- **RevenueCat "State of Subscription Apps" (SOSA).** The 2025 edition covers about 75k apps and more than $10B in revenue. The 2026 edition covers 115k+ apps and $16B+, across iOS, Android and Web. Figures are mostly medians of app-level rates. Per-segment sample sizes are not published.
- **Adapty "State of In-App Subscriptions" (SOIS).** The 2025 edition covers 11k+ apps and $1.9B. The 2026 edition covers 16k+ apps and $3B, mostly 2025 data. Adapty's methodology note says install-to-trial and install-to-paid are averages of per-app rates. Most other figures are not labelled as medians or averages.
- **Platform and geography.** Neither vendor's public pages split out iOS-only or UK-only figures. The closest regions are "North America" and "Western Europe".
- **Reliability.** Both are vendor datasets drawn from each vendor's own customers, so they lean towards apps that monetise actively. Several figures below came from WebFetch summaries of the vendors' long report pages, not from the PDFs. Where those summaries disagreed with themselves, this is flagged.

---

## 1. Current download-to-paid, download-to-trial and trial-to-paid rates for H&F (by paywall type, region and price tier)

### Takeaway
At the median, an H&F app turns about 7% of downloads into trials and about 38–40% of trials into payers, giving about 3% download-to-paid by day 35 (RevenueCat 2026). Freemium apps across all categories sit near 2% download-to-paid by day 35, against about 11–12% for hard paywalls. A freemium, low-priced app like Tidemark should plan for roughly 1–3% of downloads paying, not 10%.

### Cited Findings
**H&F funnel, RevenueCat SOSA 2026 (medians, all platforms)**
- **Download-to-trial (by day 30):** median 6.9%; "top performers" above 23%. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- **Download-to-paid (by day 35):** median 2.9%; top quartile above 6.2%. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- **Trial-to-paid:** median 37.7%; top quartile above 51.4%. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- **Trial timing:** 82.1% of H&F trials start on day 0, the day of install. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)

**H&F funnel, RevenueCat SOSA 2025 (older dataset)**
- **Trial-to-paid:** median 39.9%; top 10% reach 68.3%. — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025); [Athletech News summary](https://athletechnews.com/fitness-apps-monetizable-winner-take-all-or-most/)
- **Download-to-paid (by day 35):** H&F P90 is 12.1%, the highest of the categories cited. — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **iOS vs Android:** H&F conversion is "around 2x higher on iOS" than on Android. — [Athletech News, citing SOSA 2025](https://athletechnews.com/fitness-apps-monetizable-winner-take-all-or-most/)

**H&F funnel, Adapty SOIS 2026**
- **Weekly plans with a trial:** install-to-trial 9.5%, trial-to-paid 42.2%, first renewal 67.7%. — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)
- **H&F trial-to-paid across plans:** 35.0%, the top category; Entertainment is lowest at 19.1%. This comes from search-result text quoting Adapty 2026; I did not see it on the page itself. — [Adapty SOIS 2026](https://adapty.io/state-of-in-app-subscriptions-2026)
- **All-category install-to-trial:** global 11.2%; North America 14.5%; other regions 7.6–10.2%. — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)
- **All-category install-to-paid (direct purchase):** about 3.7%. Onboarding paywalls with trials average 1.78% install-to-paid. — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)
- **Trial timing:** 86.1% of H&F trials convert or start on day 0, with a second smaller window on days 4–14 (2.6%). — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)

**Adapty SOIS 2025 (older)**
- Install-to-trial is below 12% in most cases. The report also says that even in H&F "full-funnel conversion is under 0.1%". That figure is out of line with every other source and its definition is unclear, so I would not rely on it. — [Adapty SOIS 2025 summary](https://adapty.io/blog/state-of-in-app-subscriptions-2025-in-10-minutes/)

**Hard paywall vs freemium (all categories, RevenueCat medians)**
- **Download-to-paid by day 35, 2026:** hard paywall 10.7% (top quartile 20.0%, top 10% 38.7%) vs freemium 2.1% (top quartile 4.5%). — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/); [RevenueCat 2026 trends blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
  - The trends blog's text calls this "trial-to-paid" while its chart says "download-to-paid", so the metric label is ambiguous.
- **Download-to-paid by day 35, 2025:** hard paywall 12.11% vs freemium 2.18%. — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **Revenue per install at day 60, 2026:** hard paywall $3.09 vs freemium $0.38, about 8x. — [RevenueCat 2026 trends blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- **Year-1 retention of yearly subscribers, 2026:** 27% (hard) vs 28% (freemium), described as negligible. — [RevenueCat 2026 trends blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- **Monthly-plan retention at 1 year, 2025:** 12.8% (hard) vs 9.3% (freemium). — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **Refund rate, 2025:** 5.8% (hard) vs 3.4% (freemium). — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **Secondary summary:** hard paywalls convert 5.5x better than freemium, with 2x LTV per subscriber and 1.7x the refund rate. — [Airbridge (secondary)](https://www.airbridge.io/en/blog/subscription-app-pricing-by-category-2026-benchmark)

**By region (all categories, RevenueCat 2026 medians)**
| Metric | North America | Western Europe |
|---|---|---|
| Download-to-trial, day 30 | 7.1% | 5.0% |
| Trial-to-paid | 34.2% | 29.7% |
| Download-to-paid, day 35 | 2.6–2.8%* | 2.0% |
| Revenue per install, day 14 | $0.38 | $0.25 |
| Revenue per install, day 60 | $0.55 | $0.33 |
| Yearly realised LTV per payer | $26.07 | $26.64 |

\*2.6% when grouped by developer HQ, 2.8% when grouped by user location.

— [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)

**By region (RevenueCat 2025)**
- Third-renewal rate is above 79% in North America and Western Europe.
- Latin America trial-to-paid median is 25.0%.

— [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)

**By price tier (all categories, RevenueCat 2026 medians)**
| Metric | Low | Mid | High |
|---|---|---|---|
| Download-to-trial | 4.4% | 5.4% | 8.9% |
| Download-to-paid, day 35 | 1.4% | 2.0% | 2.8% |
| Yearly realised LTV | $10.69 | $28.75 | $62.19 |
| Monthly realised LTV | $6.67 | $15.78 | $35.89 |

— [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)

**By price tier (RevenueCat 2025)**
| Metric | Low | High |
|---|---|---|
| Download-to-trial | 4.3% | 9.8% |
| Trial-to-paid | 47.8% | 28.4% |
| Download-to-paid, day 35 | 1.49% | 2.66% |
| Year-1 LTV | $8.08 | $55.21 |

— [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)

**H&F monetisation per install and per payer**
- **RevenueCat 2026:** revenue per install is $0.48 at day 14 and $0.66 at day 60, against all-category medians of $0.23 and $0.34. Realised LTV per payer is $24.23 after month 1 and $35.64 after year 1. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- **Adapty 2026:** H&F 12-month install LTV median is $1.21, the highest of any category. The top 10% of H&F apps take 92.6% of category revenue. — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)

### Inferences
- **Benchmark band for Tidemark.** Tidemark is freemium (free core, no onboarding hard paywall) and low-priced: £19.99/yr is about half the H&F median yearly price of ~$39.94. Its realistic band is about 1.4–2.9% download-to-paid by day 35. Low-price download-to-trial is about 4.3–4.4%. Low-price trial-to-paid is better than average at about 48% (2025 data).
- **Worked example.** 1,000 downloads → ~45–70 trials → ~20–30 paying users at the median.
- **Regions.** UK users probably sit between the North America and Western Europe figures. Western Europe converts slightly worse than North America but has similar LTV per payer.
- **Hard paywall is not an option.** The ~5x hard-paywall conversion advantage does not transfer, because Tidemark's free core is a product promise. The relevant lever is how often and where the in-app upgrade prompt appears.
- **Lower price per payer, higher conversion.** A low price lowers LTV per payer far more than it raises conversion. In RevenueCat's data, low-price apps actually start fewer trials but convert them better.

### Gaps
- No public UK-only or iOS-only H&F conversion figures; only North America and Western Europe aggregates.
- H&F figures are not split by paywall type in the public pages. The hard vs freemium split is all-category only.
- The Adapty 2025 "<0.1% full-funnel" figure could not be reconciled with the rest.
- No indie weight-tracker developer has published real conversion numbers. Happy Scale revenue estimates from third parties range from under $10k to about $150k a month, which is unusable: [AppGoblin](https://appgoblin.info/apps/532430574), [ScreensDesign](https://screensdesign.com/showcase/happy-scale). No MacroFactor or Cronometer funnel data was found.

---

## 2. Free trial vs no trial, and trial length (3 vs 7 vs 14+ days): conversion, refunds and churn

### Takeaway
In the observational data, longer trials convert better and renew better. A 5–9 day trial is the H&F norm and suits a monthly plan. For annual plans, retention keeps improving out to 10–32 days. The one randomised 3-day vs 7-day test found that the longer trial raised trial starts but did not raise immediate conversion. A 7-day trial on a weight tracker is well supported. A 14-day trial is plausible for the annual plan but unproven.

### Cited Findings
**Trial length vs conversion (all categories, RevenueCat medians)**
| Trial length | Trial-to-paid, 2026 | Trial-to-paid, 2025 |
|---|---|---|
| ≤4 days | 25.5% | 26.8% |
| 5–9 days | 37.4% | n/a |
| 17–32 days | 42.5% | 45.7% |

— [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/); [Athletech News on 2025](https://athletechnews.com/fitness-apps-monetizable-winner-take-all-or-most/)

**Trial lengths H&F apps use**
- 54.0% of H&F trials are 5–9 days, the highest mid-length share of any category. H&F has the lowest ≤4-day share. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- Among the top 100 H&F apps, 81% of weekly plans use ≤4-day trials. For monthly and annual plans, H&F favours 5–9 days. — [RevenueCat free-trial-length study, Sep 2026](https://www.revenuecat.com/blog/growth/free-trial-length)
- **Mixed trial strategy:** 59% of H&F apps use one (some plans with a trial, some without), the highest of any category. Only 18.3% use no trial at all, the lowest of any category. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- Across all apps, trials of 4 days or less are growing: 42.1% of trials in 2025, 46.5% in 2026. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)

**Trial length by plan: RevenueCat free-trial-length study**
Sample: 17k+ apps on the App Store and Google Play, Aug 2025–Jul 2026, median app-level values. — [RevenueCat free-trial-length study](https://www.revenuecat.com/blog/growth/free-trial-length)

Monthly plans, all categories:
| Trial length | Trial-to-paid | First renewal |
|---|---|---|
| ≤4 days | 39.6% | 54.2% |
| 5–9 days | 45.9% | 62.8% |
| 10–16 days | 46.6% | 72.0% |
| 17–32 days | 43.7% | 77.5% |

Annual plans, all categories:
| Trial length | Trial-to-paid | First renewal |
|---|---|---|
| ≤4 days | 24% | 18.3% |
| 5–9 days | 33% | 25.3% |
| 10–16 days | 43% | 36.4% |
| 17–32 days | 44.6% | 47.5% |

- **Trial users who paid and then renewed once, annual plans:** rises from 3.5% (≤4 days) to 18.5% (17–32 days).
- **H&F monthly plans specifically:** trial-to-paid is 46.8% at 5–9 days vs 40.4% at 10–16 days. First renewal rises from 51.5% (≤4 days) to 77.1% (17–32 days).

**Trial vs no trial: first renewal among paying subscribers (all categories)**
| Plan | No trial | ≤4 days | 5–9 days | 10–16 days | 17–32 days |
|---|---|---|---|---|---|
| Weekly | 35.9% | 57.9% | 65.9% | too few apps | too few apps |
| Monthly | 49.5% | 54.2% | 62.8% | 72.0% | 77.5% |
| Annual | 26.6% | 18.3% | 25.3% | 36.4% | 47.5% |

The authors note these figures do not show how many users would buy when offered no trial. — [RevenueCat free-trial-length study](https://www.revenuecat.com/blog/growth/free-trial-length)

**Trial vs no trial: Adapty**
- **Adapty 2026:** trial users show 8–60% better first-renewal retention than non-trial users, depending on plan. Weekly plans with a trial keep 19% at 12 months vs 13% without. For H&F, trials lift 12-month LTV on annual plans and annual-with-trial beats direct annual purchase, but no figures are given. — [Adapty trial vs direct](https://adapty.io/blog/free-trial-vs-direct-purchase-subscription-apps/)
- **Adapty 2025 (older):** trials "don't improve early conversion" but trial users have up to 64% higher LTV. Weekly day-30 retention rises from 23% to 42% with a trial. — [Adapty SOIS 2025 summary](https://adapty.io/blog/state-of-in-app-subscriptions-2025-in-10-minutes/)

**Controlled experiments**
- **Randomised field study, 3-day vs 7-day trial:** 680,588 new users in 190 countries. The 7-day trial raised trial adoption by 11.1% and delayed conversion by 42.4%, with no significant effect on immediate conversion. The app's category was not confirmed; this is from a search summary of the paper. — [Frontiers in Psychology 2025](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1568868/pdf)
- **RevenueCat 7-day vs 14-day A/B test:** the 14-day trial gave slightly more trial starts but fewer conversions overall. This is from a search summary; I did not verify the details. — [RevenueCat 7-day trial post](https://www.revenuecat.com/blog/growth/7-day-trial-subscription-app)

**Cancellation timing**
- Share of trial cancellations made on day 0: 55.4% for 3-day trials, 39.8% for 7-day, 35.7% for 14-day and 31.1% for 30-day. 84% of 3-day trial cancellations happen on day 0–1. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/); [RevenueCat 2026 trends blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)

**Refunds**
- Trial users request refunds more often than direct buyers. In the worst category-region combinations, refunds reach up to 14% of revenue. Trial refunds are 5.3% in APAC and 3.1% in the Middle East and Africa. — [Adapty trial vs direct](https://adapty.io/blog/free-trial-vs-direct-purchase-subscription-apps/)
- No source compares refund rates by trial length.

**Apple's introductory offer rules**
- Free-trial lengths available: 3 days; 1 or 2 weeks; 1, 2, 3 or 6 months; 1 year.
- One introductory offer per customer per subscription group, and returning customers count, so a 3-day vs 7-day test needs separate subscription groups.

— [Apple: introductory offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/); [Adapty: A/B testing trials on iOS](https://adapty.io/blog/how-to-ab-test-free-trials-on-ios/)

### Inferences
- **Keep the 7-day trial.** It matches the H&F norm and the best H&F monthly conversion bucket (5–9 days, 46.8%).
- **Consider 14 days on the annual plan.** For annual plans, renewal at 10–16 days (36.4%) is well above 5–9 days (25.3%). A weight tracker's value (trend lines, weekly averages) needs about 1–2 weeks of weigh-ins to show. Apple's 2-week option allows this. It would need its own experiment and is untested in H&F.
- **Avoid 3-day trials.** They have the worst conversion and the most day-0 cancellations.
- **Trial vs no trial is unresolved.** Observational data favours trials for monthly and annual renewal. The controlled evidence shows trials mostly change timing and trial uptake, not total conversion. Self-selection bias is likely.

### Gaps
- No H&F-specific randomised trial-length test with refund data.
- No public trial-length split by UK or iOS.
- The details of RevenueCat's 7 vs 14-day test and the Frontiers study (category, which plan) were not verified at the primary source.

---

## 3. Annual vs monthly vs lifetime mix: revenue share, year-1 retention and renewal, and the effect of a lifetime option

### Takeaway
H&F is the most annual-heavy category. Annual plans give about 59–61% of H&F revenue and about 67% of H&F subscriptions sold (2025). But only about a quarter of H&F annual subscribers renew at the first renewal (median 25%), against 57% first renewal for monthly. A lifetime tier is rare in H&F, and no public data measures how much it cannibalises subscriptions.

### Cited Findings
**Plan mix**
- **H&F share of subscriptions sold:** yearly plans are 67% (2025). — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **H&F in the 2026 report is internally inconsistent.** The fetched page says H&F "leads annual adoption at 68%" in one place and is "monthly-heavy (68%)" in another. A revenue section gives 59% of H&F revenue from annual plans. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- **H&F annual share of revenue (Adapty):** 51% in 2023, rising to 61% in 2025. — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)
- **All-category mix (RevenueCat 2026):** 42% monthly and 34% yearly. Annual share of subscriptions sold fell from 41.4% to 33.6% year on year. Lifetime and other plans are under 5% in every region. By category the range is 4–18%, highest in Gaming and lowest in H&F. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- **Weekly plans (all categories, Adapty):** 56% of subscription revenue. — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)

**H&F pricing norms (RevenueCat 2026)**
- Clusters at about $39.94/year, $9.99/month and $4.99/week. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- Happy Scale, a comparable indie weight tracker, charges $1.99/month, $11.99/year and $39.99 lifetime in the US (lifetime = 3.3x annual). — [App Store listing](https://apps.apple.com/us/app/happy-scale/id532430574)

**H&F first-renewal rates (RevenueCat, from SOSA 2026 data)**
| Plan | 25th percentile | Median | 75th percentile |
|---|---|---|---|
| Annual | 16% | 25% | 37% |
| Monthly | 46% | 57% | 68% |
| Weekly | 39% | 54% | 64% |

— [RevenueCat renewal rates by category](https://www.revenuecat.com/blog/average-subscription-renewal-rates-by-app-category/)

**Year-1 retention (all categories)**
- **2025:** yearly 44.1%, monthly 17.0%, weekly 3.4%. First renewal median 61.7%; third renewal above 77%. — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **2026:** first-year annual retention fell from 31% to 28%. — [RevenueCat via search summary](https://www.revenuecat.com/sosa-2026-insights-part-2)
- **2026, trends blog:** about 72% of annual subscribers cancel within year 1, up from about 56%. 35% of annual cancellations happen in month 1, then 3–10% per month, then a spike in month 12. — [RevenueCat 2026 trends blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- **95% of annual subscribers who cancel never return.** — [9to5Mac, May 2026](https://9to5mac.com/2026/05/27/new-report-shows-annual-app-subscribers-rarely-return-after-they-cancel/)
- **Year-1 retention by price tier, 2025:** annual 53.7% (low) vs 48.3% (high). Monthly 22.5% (low), 16.4% (mid), 12.2% (high). — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **Annual retention after 1 year by price tier, 2026 data:** 36% (low), 26% (mid), 23% (high). — [RevenueCat renewal rates by category](https://www.revenuecat.com/blog/average-subscription-renewal-rates-by-app-category/)
- **The sources do not agree on definitions.** Year-1 annual retention appears as 44.1% (2025 report), 33.9% (2025 blog via search), 28% (2026) and about 27–28% (hard and freemium, 2026). The definitions differ (retention vs renewal vs auto-renew status).

**Lifetime purchases**
- 18–24% of apps (outside Photo & Video, Education and Travel) offer both subscription and lifetime. Lifetime is often priced at 2x to nearly 12x annual. Examples:

| App | Lifetime price | Multiple of annual |
|---|---|---|
| Calm | $399 | 5.0x |
| Fiit | £375 (£299 on offer) | 3.1x |
| Moonly | $59.98 | 2.1x |
| Waking Up | $1,500 | 11.5x |

  No figures on cannibalisation. — [RevenueCat: lifetime subscriptions, Nov 2025](https://revenuecat.com/blog/growth/lifetime-subscriptions)
- A lifetime option can anchor the annual price so it feels like a smaller commitment. It can also cannibalise recurring revenue. — [RevenueCat monetisation codelab](https://revenuecat.github.io/codelabs/monetization-strategies.html); [Superwall: lifetime or no lifetime](https://superwall.com/solutions/lifetime-or-no-lifetime)
- Lifetime and long plans "lost ground" in 2025 while one-time purchases grew 6% (all categories). — [Adapty SOIS 2025 summary](https://adapty.io/blog/state-of-in-app-subscriptions-2025-in-10-minutes/)

### Inferences
- **Lifetime pricing.** Tidemark's £49.99 lifetime is 2.5x annual, at the low end of the 2x–12x range. With H&F first annual renewal at about 25% (36% for low-price apps), the expected annual subscriber pays about £19.99 × (1 + 0.25–0.36 + …) ≈ £25–31 gross over its life. On that basis a lifetime price of about 2.5x annual is roughly revenue-neutral against a typical annual subscriber, and above that subscriber's expected value if renewal is poor. Cannibalisation therefore costs little in expectation, though it gives up upside from loyal long-term users.
- **Privacy-minded audience.** These users often dislike subscriptions, so the lifetime tier may also capture buyers who would never subscribe. This is speculative; no data was found.
- **Annual dominates and renews poorly.** Expect annual to dominate sales (as H&F norms suggest), with the month-12 renewal as the main churn point.

### Gaps
- No public data quantifying how a lifetime option changes total subscription revenue (no published A/B results).
- No H&F-specific lifetime revenue share.
- H&F year-1 retention by plan is not public; only first-renewal quartiles.

---

## 4. Effect of price points and annual discount size on H&F conversion, and introductory offers

### Takeaway
Higher prices raise trial starts and revenue per install but lower trial-to-paid and retention. Low prices retain best. There is no public benchmark isolating annual-discount size. Adapty says only about 10% of apps use discounts. Apple supports pay-as-you-go and pay-up-front introductory offers as alternatives to a free trial.

### Cited Findings
- **Price tier effects (RevenueCat):** see the tier tables in section 1. High-priced apps get roughly 2x the download-to-trial rate and 5–6x the yearly LTV of low-priced apps. Low-priced apps get higher trial-to-paid and better retention. Low-priced plans have a 2.2% refund rate (2025). — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025); [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps-2026/)
- **Adapty 2026 pricing:**
  - One-year LTV is $70 for high-priced annual plans vs $17 for low-priced ones.
  - Higher-priced weekly plans retain about 12% better at first renewal.
  - The weekly pricing index is about 1.3 for the UK, France and Germany (above the US base).
  - About 10% of apps use discounts.

  — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)
- **Average prices (Adapty 2025, all categories, older):**

| Plan | US | Europe |
|---|---|---|
| Monthly | $15.2 | $13.3 |
| Annual | $44.6 | $42 |

  No UK split. — [Adapty SOIS 2025 summary](https://adapty.io/blog/state-of-in-app-subscriptions-2025-in-10-minutes/)
- **Paywall layout (Adapty 2026, via search summary):**
  - Apps with two plan lengths have 67% higher conversion.
  - 90% of users choose weekly when it is pre-selected, vs 46% choosing annual when annual is pre-selected.
  - Annual-pre-selected paywalls convert about as well as weekly-pre-selected ones.
  - Monthly plans typically convert better than annual-only offers.

  — [Adapty State of Paywalls 2026](https://adapty.io/state-of-paywalls/report/); [RevenueCat on annual plans](https://www.revenuecat.com/blog/growth/annual-subscriptions-apps-pros-cons/)
- **Experiments (Adapty):** trial-related experiments win on LTV 59.6% of the time, vs 45.5% for price tests and 34.6% for visual or text changes. — [Adapty trial vs direct](https://adapty.io/blog/free-trial-vs-direct-purchase-subscription-apps/)
- **Apple introductory offers:**
  - Types: free trial, pay up front (1, 2, 3 or 6 months, or 1 year) and pay as you go (for a monthly product, 1–12 months).
  - One introductory offer per customer per subscription group, with territory-level pricing.

  — [Apple developer docs](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/)

### Inferences
- **Tidemark's discount and price.** The annual plan's ~58% discount on 12 x monthly is steep. The H&F medians ($9.99/month and $39.94/year) imply about 67% off. Typical H&F discounts are therefore in the same range or steeper, so the discount size is not out of line.
- **Room to raise prices.** Tidemark's absolute prices are low-tier, so a higher annual price (for example £24.99–£29.99) is a candidate test. That reflects RevenueCat's large LTV gap between low and mid tiers, but it is unproven for this app.
- **Introductory offers.** A pay-up-front or pay-as-you-go offer (for example a discounted first year) is an option for users who decline the trial. No H&F conversion data on these offer types was found.

### Gaps
- No public H&F data on the effect of annual-discount size on conversion.
- No benchmark data on the effectiveness of introductory pay-up-front or pay-as-you-go offers vs free trials.
- No UK-specific price elasticity data.

---

## 5. Typical churn and retention curves for H&F subscriptions, and refund rates

### Takeaway
For H&F, the median first renewal is 57% for monthly and 25% for annual. Annual cancellations cluster in month 1 and month 12. The H&F refund rate was 4.71% (RevenueCat 2025), the second-highest category. On the App Store, involuntary churn from billing failures is about 14% of cancellations.

### Cited Findings
- **H&F first-renewal quartiles:** annual 16/25/37%, monthly 46/57/68%, weekly 39/54/64%. — [RevenueCat renewal rates by category](https://www.revenuecat.com/blog/average-subscription-renewal-rates-by-app-category/)
- **H&F weekly plans (Adapty 2026):** first renewal 67.7%. High-tier weekly plans retain about 82% by renewals 2–3. — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)
- **All-category renewal curve (Adapty 2026):**

| Renewal | Retained |
|---|---|
| 1st | 59.2% |
| 2nd | 45.1% |
| 3rd | 37.1% |
| 4th | 31.6% |
| 5th | 27.6% |

  — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)
- **All-category, 2025 (Adapty, older):** monthly keeps 43% at day 90 and 17% at one year. Weekly: 65% cancel within 30 days and 5% remain at one year. — [Adapty SOIS 2025 summary](https://adapty.io/blog/state-of-in-app-subscriptions-2025-in-10-minutes/)
- **Monthly payers reaching year two:** barely 10% (commentary by Thomas Petit). Churn at first renewal is 15–40% for monthly and 30–50% for weekly. — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **Annual cancellation curve (2026):** 35% of year-1 cancellations happen in month 1, then 3–10% per month, then a spike in month 12. — [RevenueCat 2026 trends blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- **Billing failures:** 14% of cancellations on the App Store (15.1% in 2025) vs 31% on Google Play. — [RevenueCat 2026 trends blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)

**Refund rates**
- **H&F:** 4.71% (2025), second only to Education (4.86%). — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **All-category by model and price, 2025:** hard paywall 5.8% vs freemium 3.4%; low-priced plans 2.2%. Western Europe and APAC are below 3.0%. — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- **All-category median for non-AI apps:** 3.5% (vs 4.2% for AI apps). — [AppFollow citing RevenueCat (secondary)](https://appfollow.io/blog/subscription-metrics-mobile-app)
- **By plan (Adapty 2025):** annual plans refund most (4.2%) and weekly least (2.6%). The US and LATAM are above 3%; Europe and MEA are about 2.3%. — [Adapty SOIS 2025 summary](https://adapty.io/blog/state-of-in-app-subscriptions-2025-in-10-minutes/)

### Inferences
- **Planning assumptions for Tidemark (freemium, low price, Apple-only):**
  - Refunds about 2–4% of first purchases. Freemium and low-price both pull below the 4.71% H&F figure.
  - About 55–60% of monthly subscribers renewing once.
  - About 25–36% of annual subscribers renewing at month 12.
- **Retention priorities.** Weight tracking has natural drop-off once goals are reached. The month-12 annual renewal is the critical retention moment. Month 1 matters too, because that is when auto-renew is switched off.

### Gaps
- No public H&F refund rate for 2026, and no H&F refund split by iOS, UK or plan.
- No public month-by-month H&F survival curves; only first-renewal quartiles and all-category curves.
