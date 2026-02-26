# User Task Properties — Future Enhancements

Fields that could be added to the User Task properties panel (Task Configuration section).

## Currently Implemented

| Field | Storage | Notes |
|---|---|---|
| `TaskName` | dataInputAssociation | WID task name identifier |
| `ActorId` | dataInputAssociation | Comma-separated user IDs |
| `GroupId` | dataInputAssociation | Comma-separated group names |
| `CreatedBy` | dataInputAssociation | User who created the task |
| `Skippable` | dataInputAssociation | Boolean — whether task can be skipped |
| `Priority` | dataInputAssociation | Numeric priority value |
| `customSLADueDate` | drools:metaData | Duration (e.g., `1d`, `P2D`) or expression (`#{variable}`) |

## High Priority

### Comment (dataInputAssociation)
Short task note visible in task list UIs (Business Central Task Inbox, PAM task list).
Supports expression syntax like `#{processVariable}` for dynamic values.
Example: `Review request for #{applicantName}`

### Description (dataInputAssociation)
Longer human-readable instructions for the assignee. Shown when the user opens the task detail view. Supports `#{variable}` expressions. Distinct from Comment — Comment is a short identifier, Description is instructional text.

### BusinessAdministratorId (dataInputAssociation)
Comma-separated list of users who can administrate this task (view/manage/delegate) even if not the assigned actor. Defaults to `Administrator` user if not set.
Format: `john,mary` or `#{adminUserVar}`

### BusinessAdministratorGroupId (dataInputAssociation)
Comma-separated list of groups whose members can administrate the task. Often used instead of BusinessAdministratorId since individual user lists are fragile.
Format: `managers,supervisors`

### ExcludedOwnerId (dataInputAssociation)
Comma-separated list of users explicitly excluded from being potential owners. Classic use case: the person who submitted a request cannot also approve it (four-eyes principle / separation of duties). Used in Kogito example processes on second approval stages.
Format: `#{firstApproverVar}` or `john,mary`

## Medium Priority

### NotStartedReassign (dataInputAssociation)
Auto-reassign the task if it hasn't been started within a duration. Complex structured string format:
```
[users:<comma-list>|groups:<comma-list>]@[<duration>]
```
Example: `[users:Pepe,Pepa|groups:Admin,Managers]@[1m]`
Duration formats: `PT30S` (ISO 8601), `1m`/`4h`/`2d` (shorthand), `P1D` (ISO 8601)
Multiple specs can be chained with `^`.

### NotCompletedReassign (dataInputAssociation)
Same format as NotStartedReassign, but triggers if the task hasn't been completed within the duration.

### NotStartedNotify (dataInputAssociation)
Send email notification if task hasn't been started within a duration. Complex structured format:
```
[from:<email>|tousers:<comma-list>|togroups:<comma-list>|toemails:<email-list>|replyTo:<email>|subject:<text>|body:<text>]@[<duration>]
```
Example: `[from:admin@company.com|tousers:|togroups:|toemails:manager@company.com|replyTo:|subject:Task pending|body:Please start this task]@[PT30S]`
Use `R/` prefix on duration for repeating notifications: `@[R/PT1M]`
Requires email notification infrastructure configured in jBPM.

### NotCompletedNotify (dataInputAssociation)
Same format as NotStartedNotify, but triggers if the task hasn't been completed.

### customAsync (drools:metaData)
When set to `true`, marks the task for asynchronous execution — submitted to a JMS/executor queue rather than running on the calling thread. Prevents thread blocking in high-load scenarios.
Value: `true` or `false` (checkbox)
Relevant for high-throughput BAMOE deployments.

## Low Priority

### Content (dataInputAssociation)
Represents serialized task data payload (XML/JSON blob). Largely obsolete in Kogito/BAMOE — modern designs use typed data input/output mappings instead. Was relevant in older jBPM 5.x/6.x.

### Locale (dataInputAssociation)
Specifies the locale/language for the task (e.g., `en-US`, `fr-FR`). Controls which language variant of the task's name/description/form is shown. Only relevant if multi-locale task form support is implemented.

### DueDate (dataInputAssociation)
Sets the task's due date as a hard calendar date (vs. SLA Due Date which is a relative duration). Stored as `java.util.Date` or ISO 8601 date string. Shown in task list UI as the "due" display.
Format: `2026-12-31T17:00:00` or `#{deadlineVar}`
Complements `customSLADueDate` — DueDate is a display/informational field, SLA triggers actual timer-based violations.

## Implementation Notes

- All `dataInputAssociation` fields follow the existing pattern in `properties-provider.ts`: use `getConfigValue()`/`setConfigValue()` helpers with `TextFieldEntry` or `CheckboxEntry`.
- New dataInputAssociation field names should be added to `JBPM_CONFIG_FIELDS` array to exclude them from the Data I/O Mappings list.
- `drools:metaData` fields follow the `customSLADueDate` pattern: read/write `extensionElements > drools:metaData[name="..."] > drools:metaValue`.
- NotStarted/NotCompleted Reassign/Notify fields have complex formats — consider building a structured sub-form that composes the string rather than a raw text field.

## References

- [jBPM Human Tasks Documentation](https://docs.jbpm.org/7.49.0.Final/jbpm-docs/html_single/)
- [Kogito Task Deadlines — KIE Blog](https://blog.kie.org/2021/08/kogito-task-deadlines.html)
- [Aletyx — Human Tasks in Detail](https://docs.aletyx.ai/core/processes/advanced-bpmn/tasks/human-tasks/)
- [KIE Blog — Self-manageable User Tasks](https://blog.kie.org/2012/06/self-managable-user-tasks-notification-and-reassignment.html)
- [KIE Blog — BPMN and Metadata](https://blog.kie.org/2021/09/leveraging-bpmn-capabilities-with-metadata.html)
