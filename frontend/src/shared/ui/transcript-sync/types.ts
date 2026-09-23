/** Read-only projection of Segment from docs/meeting-contract.md, not a second API DTO. */
export type TranscriptSegment = {
  id: string;
  recording_id: string;
  result_version_id: string;
  start_ms: number;
  end_ms: number;
  text: string;
};
