# Meeting Minutes Design

## User Story
A project user enters meeting metadata and notes/transcript,
receives an AI minutes draft, reviews it, approves it,
then publishes approved Decisions/Actions/Issues/Customer Requests.

## Entities
Meeting
MeetingParticipant
MeetingSource
MeetingMinutes
Decision
ActionItem
Issue
CustomerRequest

## Status
MeetingMinutes:
AI_DRAFT → REVIEWED → APPROVED → SUPERSEDED

## Safety
Unknown owner/due/speaker = REVIEW_REQUIRED.
No auto Requirement/Contract change.

## TranscriptProvider
ManualTranscriptProvider first.
Cloud/Local STT extension later.
