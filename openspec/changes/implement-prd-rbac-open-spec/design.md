# Design

## Roles

The canonical PRD roles are:

- `PLATFORM_ADMIN`
- `ORG_ADMIN`
- `OFFICE_ADMIN`
- `EVALUATOR`
- `APPROVER`
- `BENEFICIARY`

The web compatibility aliases remain:

- `dswd_admin` -> `ORG_ADMIN`
- `satellite_admin` -> `OFFICE_ADMIN`
- `customer` -> `BENEFICIARY`

## Policy Shape

Each grant has:

- `permission`: a stable machine-readable action such as
  `program_template.create` or `application.approve`
- `scope`: one of `platform`, `platform_aggregate`, `organization`, `office`,
  `assigned_task`, or `own_account`

Every authorization decision evaluates both the permission grant and the
resource scope. Explicit denies override grants.

## Separation Of Duties

`application.approve` is denied when the acting user is the same user that
evaluated or endorsed the application.

## Auditability

The policy does not mutate audit logs. Existing append-only audit behavior
continues to apply to RBAC-relevant state changes.
