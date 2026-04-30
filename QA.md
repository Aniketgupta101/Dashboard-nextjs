# Enterprise Backend Database Data Dictionary

This file is a detailed data dictionary for `enterprise-backend/prisma/schema.prisma`, intended for teams integrating this database from another codebase.

## 1) Platform and Connection

- Database engine: PostgreSQL
- ORM/schema owner: Prisma
- Source of truth: `prisma/schema.prisma`
- Local credential location: `enterprise-backend/.env`
- Connection variable (expected): `DATABASE_URL`

Security note:
- Do not copy actual username/password into docs or code.
- For analytics/dashboard access, create a dedicated read-only DB user.

## 2) Multi-Tenant Design

- `Enterprise` is the tenant root entity.
- Most business tables include `enterpriseId` to enforce tenant isolation.
- Always filter analytics queries by `enterpriseId` unless you are running cross-tenant admin reporting.

## 3) Enums

- `RoleType`: `ADMIN`, `SUBADMIN`, `USER`
- `PermissionType`: `CREATE_CONTENT`, `EDIT_CONTENT`, `DELETE_CONTENT`, `READ_CONTENT`, `MANAGE_USERS`, `MANAGE_TEAMS`, `MANAGE_ROLES`, `MANAGE_COMPANY_POLICIES`, `VIEW_SENSITIVE_DATA`, `APPROVE_BLOCKED_CONTENT`, `OVERRIDE_GUARDRAILS`, `VIEW_AUDIT_LOGS`, `VIEW_ANALYTICS`, `MANAGE_GUARDRAIL_POLICIES`, `MANAGE_GUARDRAIL_APPROVAL`
- `NotificationType`: `CONTENT_CREATED`, `CONTENT_UPDATED`, `CONTENT_DELETED`
- `HierarchyType`: `TWO_LEVEL`, `THREE_LEVEL`
- `RuleScopeType`: `ENTERPRISE`, `TEAM`, `PROJECT`, `CLIENT`
- `ModerationContentType`: `COMPANY_POLICY`, `PROJECT_POLICY`, `CHAT_PROMPT`
- `DecisionActionType`: `ALLOW`, `WARN`, `REDACT`, `BLOCK`, `REQUIRE_CONFIRMATION`, `REQUIRE_APPROVAL`
- `GuardrailQueueStatus`: `PENDING`, `APPROVED`, `REJECTED`
- `OnboardingStatus`: `NOT_STARTED`, `IN_PROGRESS`, `FAILED`, `COMPLETED`
- `OnboardingRunStatus`: `IN_PROGRESS`, `COMPLETED`, `FAILED`

## 4) Table-by-Table Data Dictionary

### `Enterprise`
Purpose: Tenant/company master record.

- `id` (`BigInt`, PK, auto-increment): internal enterprise identifier.
- `name` (`String`, required): display name of enterprise.
- `slug` (`String`, unique): URL-safe enterprise key.
- `hierarchyType` (`HierarchyType`, default `THREE_LEVEL`): org hierarchy style.
- `isActive` (`Boolean`, default `true`): active/inactive enterprise flag.
- `onboardingCompleted` (`Boolean`, default `false`): final onboarding completion flag.
- `onboardingStatus` (`OnboardingStatus`, default `NOT_STARTED`): onboarding lifecycle status.
- `onboardingLastFailedStep` (`String`, nullable): step where onboarding failed last.
- `onboardingFailReason` (`String`, nullable): reason/details of onboarding failure.
- `createdAt` (`DateTime`, default `now()`): row creation timestamp.
- `updatedAt` (`DateTime`, auto-updated): row update timestamp.

### `User`
Purpose: User account within an enterprise.

- `id` (`BigInt`, PK, auto-increment): user id.
- `enterpriseId` (`BigInt`, FK -> `Enterprise.id`): tenant ownership.
- `name` (`String`, required): full name.
- `email` (`String`, required): login/contact email.
- `password` (`String`, required): hashed password.
- `isActive` (`Boolean`, default `true`): active/inactive account flag.
- `emailNotificationsEnabled` (`Boolean`, default `true`): opt-in for emails.
- `passwordResetToken` (`String`, nullable): password reset token.
- `passwordResetExpires` (`DateTime`, nullable): reset token expiry.
- `createdAt` (`DateTime`, default `now()`): account creation time.
- `updatedAt` (`DateTime`, auto-updated): account update time.
- `deletedAt` (`DateTime`, nullable): soft-delete timestamp.

Constraints:
- Unique composite: (`enterpriseId`, `email`).

### `OnboardingRun` (`onboarding_runs`)
Purpose: Tracks onboarding job runs with idempotency.

- `id` (`BigInt`, PK, auto-increment): internal row id.
- `onboardingRunId` (`UUID`, unique): public run identifier.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `userId` (`BigInt`, nullable FK -> `User.id`): initiating user.
- `idempotencyKey` (`String`, unique): dedupe key for retry-safe run creation.
- `status` (`OnboardingRunStatus`, default `IN_PROGRESS`): run state.
- `payload` (`Json`, required): request/input payload.
- `result` (`Json`, nullable): successful run result data.
- `error` (`String`, nullable): error message.
- `lastFailedStep` (`String`, nullable): failing step label.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.
- `completedAt` (`DateTime`, nullable): completion timestamp.

### `UserPersonalization`
Purpose: Optional personalization profile per user.

- `id` (`BigInt`, PK, auto-increment): row id.
- `userId` (`BigInt`, unique FK -> `User.id`): one-to-one user mapping.
- `preferredName` (`String`, nullable): preferred name for prompts/UI.
- `professionalWorld` (`String`, nullable): work context text.
- `velocityTraits` (`String`, nullable): user trait profile.
- `personalLife` (`String`, nullable): personal context.
- `hobbies` (`String`, nullable): interests.
- `primaryModel` (`String(20)`, nullable): preferred model id.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.

### `Role`
Purpose: Tenant-scoped RBAC role.

- `id` (`BigInt`, PK, auto-increment): role id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `name` (`String`, required): role label.
- `type` (`RoleType`, required): role category.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.

Constraints:
- Unique composite: (`enterpriseId`, `name`).

### `Permission`
Purpose: Global permission catalog.

- `id` (`BigInt`, PK, auto-increment): permission id.
- `name` (`String`, required): human-readable permission name.
- `type` (`PermissionType`, unique): canonical permission key.

### `RolePermission`
Purpose: Many-to-many bridge between roles and permissions.

- `roleId` (`BigInt`, FK -> `Role.id`): role id.
- `permissionId` (`BigInt`, FK -> `Permission.id`): permission id.

Constraints:
- Composite PK: (`roleId`, `permissionId`).

### `UserRole`
Purpose: Many-to-many bridge between users and roles.

- `userId` (`BigInt`, FK -> `User.id`): user id.
- `roleId` (`BigInt`, FK -> `Role.id`): role id.

Constraints:
- Composite PK: (`userId`, `roleId`).

### `Team`
Purpose: Team grouping within an enterprise.

- `id` (`BigInt`, PK, auto-increment): team id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `name` (`String`, required): team name.
- `createdBy` (`BigInt`, FK -> `User.id`): creator user id.
- `managerId` (`BigInt`, nullable FK -> `User.id`): manager user id.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.
- `deletedAt` (`DateTime`, nullable): soft-delete timestamp.

Constraints:
- Unique composite: (`enterpriseId`, `name`).

### `TeamUser`
Purpose: Team membership bridge table.

- `teamId` (`BigInt`, FK -> `Team.id`): team id.
- `userId` (`BigInt`, FK -> `User.id`): user id.
- `joinedAt` (`DateTime`, default `now()`): membership start time.

Constraints:
- Composite PK: (`teamId`, `userId`).

### `Content`
Purpose: Uploaded/generated content metadata.

- `id` (`BigInt`, PK, auto-increment): content id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `createdBy` (`BigInt`, FK -> `User.id`): creator user id.
- `title` (`String`, required): content title.
- `description` (`String`, nullable): optional description.
- `filePath` (`String`, required): storage path.
- `mimeType` (`String`, required): media type.
- `fileSize` (`BigInt`, required): file size in bytes.
- `moderationResult` (`Json`, nullable): moderation response payload.
- `version` (`Int`, default `1`): content version.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.
- `deletedAt` (`DateTime`, nullable): soft-delete timestamp.

### `ContentTeam`
Purpose: Links content visibility to teams.

- `contentId` (`BigInt`, FK -> `Content.id`): content id.
- `teamId` (`BigInt`, FK -> `Team.id`): team id.
- `addedAt` (`DateTime`, default `now()`): mapping created time.

Constraints:
- Composite PK: (`contentId`, `teamId`).

### `Notification`
Purpose: In-app notification records.

- `id` (`BigInt`, PK, auto-increment): notification id.
- `userId` (`BigInt`, FK -> `User.id`): target user.
- `contentId` (`BigInt`, nullable FK -> `Content.id`): related content.
- `type` (`NotificationType`, required): notification category.
- `message` (`String`, required): notification text.
- `isRead` (`Boolean`, default `false`): read/unread state.
- `createdAt` (`DateTime`, default `now()`): created time.

### `AuditLog`
Purpose: General audit trail for actions.

- `id` (`BigInt`, PK, auto-increment): event id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `userId` (`BigInt`, nullable FK -> `User.id`): actor user id.
- `contentId` (`BigInt`, nullable FK -> `Content.id`): related content id.
- `action` (`String`, required): event action key/text.
- `metadata` (`Json`, nullable): extra event payload.
- `createdAt` (`DateTime`, default `now()`): event time.

### `CompanyPolicy`
Purpose: Enterprise policy document metadata.

- `id` (`BigInt`, PK, auto-increment): policy id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `filePath` (`String`, required): storage path.
- `fileName` (`String`, required): original file name.
- `description` (`String`, nullable): policy notes.
- `mimeType` (`String`, required): file MIME type.
- `fileSize` (`BigInt`, required): bytes.
- `moderationResult` (`String`, nullable): moderation outcome payload (stored as stringified JSON).
- `startDate` (`DateTime`, required): policy effective start.
- `endDate` (`DateTime`, nullable): policy effective end.
- `isActive` (`Boolean`, default `true`): active policy flag.
- `createdBy` (`BigInt`, FK -> `User.id`): creator user id.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.
- `deletedAt` (`DateTime`, nullable): soft-delete timestamp.

### `CompanyPolicyHistory` (`company_policy_history`)
Purpose: Change log for company policies.

- `id` (`BigInt`, PK, auto-increment): history row id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `companyPolicyId` (`BigInt`, FK -> `CompanyPolicy.id`): changed policy id.
- `changedBy` (`BigInt`, nullable FK -> `User.id`): actor user id.
- `action` (`String(64)`, required): change action type.
- `changes` (`Json`, nullable): before/after or diff payload.
- `createdAt` (`DateTime`, default `now()`): event time.

### `Conversation`
Purpose: Chat conversation container.

- `conversationId` (`UUID`, PK): conversation id.
- `userId` (`BigInt`, FK -> `User.id`): owner user.
- `enterpriseId` (`BigInt`, FK -> `Enterprise.id`): tenant id.
- `title` (`String`, default `New Conversation`): conversation title.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.

### `UserPrompt`
Purpose: Raw user prompt history.

- `id` (`BigInt`, PK, auto-increment): prompt id.
- `userId` (`BigInt`, FK): prompt author.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `conversationId` (`UUID`, nullable FK -> `Conversation.conversationId`): linked conversation.
- `userPrompt` (`Text`, required): original prompt text.
- `platform` (`String`, default `ChatGPT`): source platform label.
- `source` (`String`, default `extension`): source channel label.
- `createdAt` (`DateTime`, default `now()`): created time.

### `EnhancedPrompt`
Purpose: AI-enhanced prompt output and metadata.

- `id` (`BigInt`, PK, auto-increment): row id.
- `promptId` (`BigInt`, FK -> `UserPrompt.id`): original prompt link.
- `userId` (`BigInt`, FK): user id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `teamId` (`BigInt`, nullable): related team id.
- `conversationId` (`UUID`, nullable FK): conversation id.
- `enhancedPrompt` (`Text`, required): transformed prompt text.
- `processingTime` (`Float`, nullable): processing latency.
- `intent` (`String`, nullable): inferred intent.
- `llmUsed` (`String`, nullable): model/provider identifier.
- `complexity` (`String`, nullable): complexity label.
- `domain` (`String`, nullable): domain label.
- `metadata` (`Json`, nullable): additional output metadata.
- `mode` (`String`, nullable): generation mode.
- `userStatus` (`String`, nullable): user state tag.
- `feedback` (`Int`, nullable, default `0`): rating/feedback score.
- `inputToken` (`Int`, nullable): input token count.
- `outputToken` (`Int`, nullable): output token count.
- `totalToken` (`Int`, nullable): total token count.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.

### `RefinePrompt`
Purpose: Refined prompts based on enhanced prompts.

- `id` (`BigInt`, PK, auto-increment): row id.
- `promptId` (`BigInt`, FK -> `UserPrompt.id`): raw prompt link.
- `enhancedPromptId` (`BigInt`, FK -> `EnhancedPrompt.id`): enhanced prompt link.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `conversationId` (`UUID`, nullable FK): conversation id.
- `refinedPrompt` (`Text`, required): final refined prompt.
- `llmUsed` (`String`, nullable): model/provider identifier.
- `refineQuestion1..4` (`Text`, nullable): follow-up questions.
- `refineAnswer1..4` (`Text`, nullable): corresponding answers.
- `processingTime` (`Float`, nullable): processing latency.
- `feedback` (`Int`, nullable, default `0`): feedback score.
- `inputToken` (`Int`, nullable): input tokens.
- `outputToken` (`Int`, nullable): output tokens.
- `totalToken` (`Int`, nullable): total tokens.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.

### `PromptCollection` (`prompt_collections`) [Legacy]
Purpose: Saved prompt collections.

- `collectionId` (`UUID`, PK, mapped `collection_id`): collection id.
- `userId` (`BigInt`, mapped `user_id`, FK): owner user id.
- `enterpriseId` (`BigInt`, mapped `enterprise_id`, FK): tenant id.
- `name` (`String(255)`, required): collection name.
- `description` (`Text`, nullable): collection description.
- `tag` (`String(100)`, nullable): category tag.
- `backgroundImage` (`String(500)`, nullable, mapped `background_image`): image URL/path.
- `createdAt` (`DateTime`, mapped `created_at`, default `now()`): created time.
- `updatedAt` (`DateTime`, mapped `updated_at`, auto-updated): updated time.

### `CollectionPrompt` (`collection_prompts`) [Legacy]
Purpose: Prompt membership in a collection.

- `id` (`BigInt`, PK, auto-increment): row id.
- `collectionId` (`UUID`, mapped `collection_id`, FK): collection id.
- `promptId` (`String(255)`, mapped `prompt_id`): prompt reference id (legacy text id).
- `createdAt` (`DateTime`, mapped `created_at`, default `now()`): added time.

Constraints:
- Unique composite: (`collectionId`, `promptId`).

### `SaveEnhancePrompt` [Legacy]
Purpose: Legacy store for enhanced prompts (string ids).

- `enhancedPromptId` (`String(255)`, PK): enhanced prompt id.
- `promptId` (`String(255)`, required): prompt id.
- `enhancedPrompt` (`Text`, required): enhanced text.
- `processingTime` (`Float`, nullable): latency.
- `intent` (`String(100)`, nullable): intent label.
- `llmUsed` (`String(100)`, nullable): model label.
- `complexity` (`String(50)`, nullable): complexity label.
- `domain` (`String(100)`, nullable): domain label.
- `metadata` (`Json`, nullable): metadata payload.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.
- `mode` (`String(50)`, nullable): mode label.
- `userStatus` (`String(20)`, nullable): status label.
- `feedback` (`Int`, nullable, default `0`): feedback.
- `userId` (`Int`, nullable): user id (legacy type mismatch vs `BigInt` tables).
- `teamId` (`String(255)`, nullable): team id (legacy string type).
- `conversationId` (`UUID`, nullable FK): conversation id.
- `inputToken` (`Int`, nullable): input tokens.
- `outputToken` (`Int`, nullable): output tokens.
- `totalToken` (`Int`, nullable): total tokens.

### `RefinePromptLegacy` [Legacy]
Purpose: Legacy refined prompt store (string ids).

- `refineId` (`String(255)`, PK): refined prompt id.
- `promptId` (`String(255)`, required): prompt id.
- `enhancedPromptId` (`String(255)`, required): enhanced prompt id.
- `llmUsed` (`String(100)`, nullable): model label.
- `refineQuestion1..4` (`Text`, nullable): follow-up questions.
- `refineAnswer1..4` (`Text`, nullable): follow-up answers.
- `refinedPrompt` (`Text`, required): refined prompt text.
- `processingTime` (`Float`, nullable): latency.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.
- `feedback` (`Int`, nullable, default `0`): feedback score.
- `conversationId` (`UUID`, nullable FK): conversation id.
- `userId` (`Int`, nullable): user id (legacy type).
- `inputToken` (`Int`, nullable): input tokens.
- `outputToken` (`Int`, nullable): output tokens.
- `totalToken` (`Int`, nullable): total tokens.

### `ModerationLog`
Purpose: Prompt-level moderation evaluation history.

- `id` (`BigInt`, PK, auto-increment): row id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `userId` (`BigInt`, nullable FK): user id.
- `conversationId` (`UUID`, nullable FK): conversation id.
- `prompt` (`Text`, required): full moderated input.
- `promptHash` (`String(64)`, required): hash for dedupe/search.
- `mode` (`String`, default `hybrid`): moderation mode used.
- `inputType` (`String`, default `prompt`): moderated input type.
- `strictMode` (`Boolean`, default `true`): strictness flag.
- `isSafe` (`Boolean`, nullable): safety outcome.
- `severity` (`String`, nullable): severity level.
- `detectionMethod` (`String`, nullable): classifier/method used.
- `violationCount` (`Int`, default `0`): number of violations found.
- `moderationResult` (`Json`, nullable): detailed moderation payload.
- `createdAt` (`DateTime`, default `now()`): created time.

### `RuleToggleState` (`rule_toggle_state`)
Purpose: Rule enable/disable switches by scope.

- `id` (`BigInt`, PK, auto-increment): row id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `scopeType` (`RuleScopeType`, default `ENTERPRISE`): scope category.
- `scopeRef` (`String`, default `global`): scope reference key.
- `ruleKey` (`String`, required): rule identifier.
- `enabled` (`Boolean`, default `true`): active toggle.
- `createdBy` (`BigInt`, nullable FK -> `User.id`): creator user id.
- `updatedBy` (`BigInt`, nullable FK -> `User.id`): updater user id.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.

Constraints:
- Unique composite: (`enterpriseId`, `scopeType`, `scopeRef`, `ruleKey`).

### `ModerationAuditEvent` (`moderation_audit_log`)
Purpose: Structured moderation decision audit event.

- `id` (`BigInt`, PK, auto-increment): row id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `userId` (`BigInt`, nullable FK): actor user.
- `requestId` (`String(64)`, nullable): request trace id.
- `contentType` (`ModerationContentType`, required): moderated content class.
- `sourceRefId` (`String`, nullable): upstream source reference.
- `decisionAction` (`DecisionActionType`, required): moderation action.
- `blockingViolation` (`Boolean`, default `false`): whether blocking violation occurred.
- `matchedRuleKeys` (`Json`, nullable): matched policy/rule list.
- `violations` (`Json`, nullable): structured violations.
- `metadata` (`Json`, nullable): additional context.
- `createdAt` (`DateTime`, default `now()`): event time.

### `ContentPolicyResult` (`content_policy_results`)
Purpose: Policy decision records for content/policies.

- `id` (`BigInt`, PK, auto-increment): row id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `userId` (`BigInt`, nullable FK): user id.
- `contentType` (`ModerationContentType`, required): source content category.
- `contentId` (`BigInt`, nullable FK -> `Content.id`): content id.
- `companyPolicyId` (`BigInt`, nullable FK -> `CompanyPolicy.id`): policy id.
- `sourceRefId` (`String`, nullable): external/internal reference.
- `decisionAction` (`DecisionActionType`, required): decision action.
- `isAllowed` (`Boolean`, default `true`): pass/fail boolean.
- `matchedRuleKeys` (`Json`, nullable): rules triggered.
- `violations` (`Json`, nullable): violation details.
- `moderationResult` (`Json`, nullable): full moderation output.
- `createdAt` (`DateTime`, default `now()`): decision time.

### `PromptModerationResult` (`prompt_moderation_results`)
Purpose: Decision records specifically for prompt moderation.

- `id` (`BigInt`, PK, auto-increment): row id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `userId` (`BigInt`, nullable FK): user id.
- `conversationId` (`UUID`, nullable FK): conversation id.
- `sourceRefId` (`String`, nullable): source id.
- `promptHash` (`String(64)`, nullable): prompt hash.
- `promptExcerpt` (`String`, nullable): short prompt text excerpt.
- `decisionAction` (`DecisionActionType`, required): decision action.
- `isAllowed` (`Boolean`, default `true`): pass/fail.
- `matchedRuleKeys` (`Json`, nullable): triggered rules.
- `violations` (`Json`, nullable): violation payload.
- `moderationResult` (`Json`, nullable): complete moderation result.
- `createdAt` (`DateTime`, default `now()`): decision time.

### `GuardrailApprovalQueue` (`guardrail_approval_queue`)
Purpose: Human review queue for blocked/sensitive prompts.

- `id` (`BigInt`, PK, auto-increment): queue item id.
- `enterpriseId` (`BigInt`, FK): tenant id.
- `submittedByUserId` (`BigInt`, FK -> `User.id`): submitter user.
- `reviewedByUserId` (`BigInt`, nullable FK -> `User.id`): reviewer user.
- `auditEventId` (`BigInt`, nullable): optional moderation audit event link id.
- `teamId` (`BigInt`, nullable FK -> `Team.id`): related team.
- `prompt` (`Text`, required): submitted prompt text.
- `promptHash` (`String(64)`, required): prompt hash.
- `contentType` (`String(50)`, required): content type label.
- `sourceRefId` (`String`, nullable): source reference.
- `severity` (`String(20)`, required): severity label.
- `moderationAction` (`String(30)`, required): moderation action label.
- `violations` (`Json`, nullable): violation details.
- `moderationResult` (`Json`, nullable): moderation payload.
- `matchedRuleKeys` (`Json`, nullable): matched rules.
- `status` (`GuardrailQueueStatus`, default `PENDING`): review status.
- `reviewComment` (`String`, nullable): reviewer comment.
- `reviewedAt` (`DateTime`, nullable): review timestamp.
- `createdAt` (`DateTime`, default `now()`): created time.
- `updatedAt` (`DateTime`, auto-updated): updated time.

## 5) Join/Bridge Tables (Important for Analytics)

- `UserRole`: users to roles.
- `RolePermission`: roles to permissions.
- `TeamUser`: users to teams.
- `ContentTeam`: content to teams.
- `CollectionPrompt` (legacy): collections to prompts.

These tables represent many-to-many links and should be used in joins when building team, RBAC, and content access analytics.

## 6) Soft Delete and Activity Caveats

- Soft-delete columns exist in: `User`, `Team`, `Content`, `CompanyPolicy`.
- For active-record analytics, filter `deletedAt IS NULL`.
- Use `isActive` fields where present (`Enterprise`, `User`, `CompanyPolicy`) alongside soft delete checks.

## 7) Data Type Caveats for Cross-Codebase Integrations

- Most IDs are `BigInt`; some legacy tables use `Int` or `String` identifiers.
- UUID keys are used in conversation/onboarding/collection areas.
- JSON columns are common in moderation and metadata tables; downstream code should parse JSON safely.
- Legacy tables (`SaveEnhancePrompt`, `RefinePromptLegacy`) may not align perfectly with new normalized prompt tables.

## 8) Recommended First Queries for Schema Validation

- Count rows per major domain table.
- Verify FK integrity on high-volume joins (`UserPrompt` -> `Conversation`, `EnhancedPrompt` -> `UserPrompt`).
- Check tenant partitioning by sampling `enterpriseId` distributions.
- Confirm nullability assumptions in your reporting layer before hard-coding non-null constraints.
