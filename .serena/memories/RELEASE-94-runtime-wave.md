# RELEASE-94 GPU, speakers, extraction and reminders delta

## Current Behavior

- PR119 merged main/prod `1adbcb5354ae0dd9cf167eade325f047c28454c5`, tree=420aac5.
  Coordinator verified exact prod symlink, deploy exit0, HTTPS health, healthy
  backend/frontend/Postgres and running worker; dev420 is deployed/healthy.
  This delta supersedes core-6ed682e snapshots only for the changes listed here.
- Release includes #12 UI, #15 owner inbox, extract, #101, sentinel→null, optional
  R3/#103 code and general few-shot prompt1e6f61c (10 lines, no case answer).
  Migrations include diarization0007/extraction0008→0007; reminders add none.
- External inference remains inactive: all dev BACKEND_EXTRACTION_API_* and
  BACKEND_HONCHO_* values were checked empty. Merged optional code/defaults
  establish neither activation nor external consent; Honcho remains disabled.
- [#113 GPU receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/113#issuecomment-5794753625): f5 uses pinned turbo0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf,
  CUDA float16 on one Brev L4 ($25 cap). App host retains DB/queue/ACL/publication.
  Forced-command SSH, verified host key and allowed/blocked egress probes passed.
- Synthetic19.621s→10.160s/nine segments. Cancel cleanup0.753s; missing heartbeat
  stops in20.415s, zero containers/job directories. Non-root/network-none/read-only,
  dropped capabilities and disabled container logs bound the remote runtime.
- Same206.032s case2: CPU STT149.41095s vs observed GPU16.871s (~8.9× shorter,
  including transport/poll uncertainty). This is operational, not pure inference.
  Prior GPU-STT+CPU-Qwen full pipeline663.806196s: 45 segments/seven anonymous
  clusters/33 turns/ten actions. Manual v2 preserved raw/provenance; CAS409 PASS.
- Coordinator's final GPU case2: jobaf604029→result50d8eeb6, full152.047543s;
  observed STT16.805s/Sherpa60.888s/extract75.548s; 18 actions. All45 STT segments
  and timestamps exactly match the prior GPU-STT+CPU-Qwen result.
  runtime_id=llama.cpp-b11120-cuda12.8, promptf1eef875, model hash verified;
  image fcfc72fa1a1fc15a80851dcbdd44325eec00aeeb1db65f5641cbfdd13a30249c.
  Actual CUDA5872MiB/97% utilization; containers/job directories0 after completion.
  CPU manualv2 is unchanged; GPUv1 stays unreviewed and export returns409.
  Earlier runner validJSON21.917s/EOFcleanup0.164s was a separate bounded check.
- [#12 mapping/immutability](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/12#issuecomment-5794699275): human mapping→unknown→restore clears approval,
  persists on save/reload and does not rewrite action assignees. Clusters are anonymous.
- [Final dev420/prod UI receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794894930): #101 diarize four segments visible;
  deselect/reselect resets speaker filter, solo6.2s pauses after attributed fragment,
  navigation/reload resume PASS. Fixes89525fa/7d57445 need no further patch.
  Briefing participant2→three actions→correct meeting source; console errors/warnings0.
  #120 overview/summary/actions/source-jump/home counts/notifications1 PASS, reclosed.
  Prod ordinary demo/test1 read-only: 61 segments, unreviewed draft/export disabled.
- [#15 API/UI](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/15#issuecomment-5794676238): owner inbox derives reviewed actions in Asia/Almaty,
  overdue/today/tomorrow, stable IDs, done/unreviewed suppression; no migration.
  Real polling list/sidebar3→2→1→0→1 without reload; #15 CLOSED. Two-voice job
  23900ms→four segments/two speakers/four turns,25.42s including polling.
- Both UI owners finished; coordinator confirms exact dev QA cleanup0 after
  FINAL-CLEANUP. Permanent demo and user test1/Совещание №1 remain untouched.

## Known Gaps

- GPU case2 still misses the late ten-day correction and event deadline: semantic
  FAIL despite faster completion/18 actions. No example leakage; no more prompt loops.
- #70 TTS KK100s/mixed82s full jobs are running separately. Real human Kazakh/mixed
  accuracy remains unverified; speed, TTS and clustering cannot establish it.
- Prod health/UI PASS does not transfer dev GPU case2 timings/semantic results
  to a production inference proof. Retain the exact environment of each receipt.
- Root owns the GPU and release. Serena starts no resources, inference or audits.
  Never delete/interrupt user recordings or persistent demo identities/data.

Last commit: `420aac5df7f0f764fb8ddbbbd6d1b710d0f1ea7a` (release source; prod1adbcb5 health and GPU case2 reported by coordinator).
