# INTEGRATIONS-CONNECTORS

Current Behavior: `docs/meeting-connectors.md` records official Teams/Meet/Zoom paths and realistic prerequisites. #22 is implementing provider-neutral lifecycle separately; no external bot has joined a test meeting. Hosted Recall.ai and hosted Meeting BaaS do not meet the case prohibition on sending audio/text to external cloud APIs. Meeting BaaS v2 has a documented self-hosted Kubernetes stack and is a candidate if vendor access and the full data boundary can be proven.

Known Gaps: No test organizer/account, vendor-provided charts/images, Kubernetes bot pool or complete local queue/storage setup. Teams browser participant remains an experiment, Zoom RTMS is not automatically a separate participant, Meet Media API requires Preview enrollment. No issue #22–25 is complete without live join/audio proof.

Sources: See links and decision table in `docs/meeting-connectors.md` and comments on issue #22. Public research must not include local reference paths, meeting URLs, credentials, real recordings or private data.
