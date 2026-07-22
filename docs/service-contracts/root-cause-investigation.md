# Root Cause Investigation Placeholder Contract

## Route

`POST /investigate`

## Sprint 1 behavior

The route is assigned to `root-cause-investigation` by the internal planner and
returns HTTP 501 with a version-independent placeholder response:

```json
{
  "service": "root-cause-investigation",
  "status": "not-implemented",
  "requestId": "generated-request-id",
  "message": "Root Cause Investigation will be implemented in a later sprint."
}
```

No logs or repository content are interpreted.
