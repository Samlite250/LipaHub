# Reference audit

All eight files in `Materials-References/LipaHub_Antigravity_Complete_Package/reference_source/` and all seven images in `reference_screenshots/` were inspected before implementation. `START_HERE.txt` and the master prompt establish Phase 1 as the immediate milestone. The appendix repeats the separate browser-delivered sources; it is not a server implementation.

| File | Findings and independent implementation |
| --- | --- |
| `dashboard.html` | Rendered member navigation, profile, wallet, cards, two charts, quick actions, goal, service balances, invitation links, timetable and collapsible details. Inline scripts toggle balances and copy invitation URLs. Implemented with React state, original SVG charts and browser clipboard error handling. |
| `dashboard_view_source.html` | Browser view-source capture of the same dashboard, including original HTML and inline chart configuration. No PHP, trusted balances, database schema or administrative UI is included. |
| `mulaearn.css` | Teal/cyan palette, white sidebar, colourful icon chips, gradient profile and wallet, green/red/blue/yellow summary cards and responsive header. Independently implemented using custom CSS and local LipaHub vector branding. |
| `analytics-dashboard.js` | Generic ApexCharts configurations, including unrelated analytics widgets. The dashboard's actual referral and earnings charts are configured inline in its HTML. No third-party JS copied. |
| `custom-switcher.min.js` | Theme, direction, navigation, colour, header and sidebar preferences stored in browser storage. Phase 1 includes light/dark, language and desktop collapse through React controls. Advanced template customization is not presented as implemented. |
| `custom.js` | Loader, theme toggle, tooltips, popovers, colour pickers, fullscreen, card controls and decorative template behavior. Replaced only relevant dashboard interactions. |
| `defaultmenu.min.js` | Responsive sidebar, active menu, nested dropdown positioning, overlay, resize and keyboard-adjacent navigation behavior. Implemented an independent responsive drawer and native routed links. |
| `sticky.js` | Adds a sidebar class after scrolling. LipaHub uses a fixed sidebar and sticky header in CSS. |

| Image | Inspection |
| --- | --- |
| `image.png` | Desktop dashboard at a 1280px capture width with browser chrome. Sidebar approximately 240px, top header approximately 62px, wallet padding 24px and four summary cards. |
| `image(1).png` | DevTools mobile dashboard context, emulating 412 × 924. Summary cards stack into a single column. |
| `image(2).png` | DevTools Sources and mobile dashboard. Confirms the mint header, centred logo and stacked cards. |
| `image(3).png` | Browser displays brand CSS, including white sidebar and profile banner rules. |
| `image(4).png` | DevTools CSS and mobile dashboard. Confirms constrained header logo to avoid icon collision. |
| `image(5).png` | Registration: mint background, centred logo above card, teal top border, language buttons at upper right, required fields, country selection, terms checkbox, gradient submit and sign-in link. |
| `image(6).png` | Sign-in: mint background, centred logo/card, teal top border, compact fields, reset link, checkbox and gradient button. LipaHub uses email-only sign-in until trusted username lookup exists. A remember-password checkbox was not copied: passwords are not stored by the app. Supabase manages its own auth session. |

## Intentional differences

- No third-party logos, external scripts, reference APKs, affiliate links, testimonials, private email addresses, phone numbers or reference member identity are copied into the app.
- Reference totals do not reconcile: 6,800 balance + 65,188 withdrawn + 6,500 expense = 78,488, not the displayed 75,888. Demo total is 78,488 so the wallet summary is internally consistent. Referral income is a category within that illustrative total, not an additional balance.
- Demo status is visible above the wallet. Real users get empty totals rather than fabricated account records.
- Trading and chat have prominent placements after the four summary cards and at the top of navigation. The source does not evidence a crypto robot; this is a LipaHub educational addition explicitly labelled simulation.
- Source external affiliate/gaming destinations are not converted into native working products. No external destinations are silently activated. Corresponding broader service areas are planned states.
- Authentication uses readable controls at phone sizes rather than reproducing the screenshots' very small scaled text. The mint canvas, teal border, proportions, order, spacing rhythm and card styling are retained.
- Only English and Kinyarwanda are exposed; untranslated languages are not offered as working controls.
- Admin, payment, reward and database services are not inferred from browser captures.

Original reference material is excluded from future source control by `.gitignore` because it includes third-party personal information. Do not publish those captures or the verbatim master prompt as production assets.
