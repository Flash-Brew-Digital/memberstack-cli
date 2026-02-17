export interface PlanConnection {
  id: string;
  status: string;
  type: string;
  active: boolean;
  plan: { id: string; name: string };
  payment: unknown;
}

export interface Member {
  id: string;
  createdAt: string;
  lastLogin?: string;
  auth: {
    email: string;
  };
  customFields?: Record<string, unknown>;
  metaData?: Record<string, unknown>;
  json?: Record<string, unknown>;
  loginRedirect?: string;
  permissions: { all: string[] };
  planConnections: PlanConnection[];
}

export type FieldType =
  | "TEXT"
  | "TEXT_UNIQUE"
  | "NUMBER"
  | "DECIMAL"
  | "BOOLEAN"
  | "DATE"
  | "EMAIL"
  | "URL"
  | "REFERENCE"
  | "REFERENCE_MANY"
  | "MEMBER_REFERENCE"
  | "MEMBER_REFERENCE_MANY";

export interface TableField {
  id: string;
  key: string;
  name: string;
  type: FieldType;
  required: boolean;
  defaultValue: unknown;
  tableOrder: number;
  referencedTableId: string | null;
  referencedTable?: {
    id: string;
    key: string;
    name: string;
  };
}

export type AccessRule =
  | "PUBLIC"
  | "AUTHENTICATED"
  | "AUTHENTICATED_OWN"
  | "ADMIN_ONLY";

export interface DataTable {
  id: string;
  key: string;
  name: string;
  createRule: AccessRule;
  readRule: AccessRule;
  updateRule: AccessRule;
  deleteRule: AccessRule;
  createdAt: string;
  updatedAt: string;
  fields: TableField[];
}

export interface DataRecord {
  id: string;
  tableKey?: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  internalOrder: number;
}

export interface Plan {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  image: string | null;
  status: "ACTIVE" | "INACTIVE";
  prices: unknown[];
  permissions: unknown[];
  memberCount: number | null;
  priority: number | null;
  isPaid: boolean | null;
  copiedToLive: boolean | null;
  limitMembers: boolean | null;
  memberLimit: number | null;
  teamAccountsEnabled: boolean | null;
  teamAccountUpgradeLink: string | null;
  teamAccountInviteSignupLink: string | null;
  restrictToAdmin: boolean | null;
  applyLogicToTeamMembers: boolean | null;
}

export interface PlansListOptions {
  status?: "ALL" | "ACTIVE" | "INACTIVE";
  orderBy?: "PRIORITY" | "CREATED_AT";
}

export interface PlansCreateOptions {
  name: string;
  description: string;
  icon?: string;
  isPaid?: boolean;
  teamAccountsEnabled?: boolean;
  teamAccountInviteSignupLink?: string;
  teamAccountUpgradeLink?: string;
}

export interface PlansUpdateOptions {
  name?: string;
  description?: string;
  icon?: string;
  status?: "ACTIVE" | "INACTIVE";
  limitMembers?: boolean;
  memberLimit?: string;
  teamAccountUpgradeLink?: string;
  teamAccountInviteSignupLink?: string;
  restrictToAdmin?: boolean;
}

export interface PlansOrderOptions {
  plan: string[];
}

export interface MembersListOptions {
  after?: string;
  order?: "ASC" | "DESC";
  limit?: string;
  all?: boolean;
}

export interface MembersCreateOptions {
  email: string;
  password: string;
  plans?: string[];
  customFields?: string[];
  metaData?: string[];
  loginRedirect?: string;
}

export interface MembersUpdateOptions {
  email?: string;
  customFields?: string[];
  metaData?: string[];
  json?: string;
  loginRedirect?: string;
}

export interface PlanOptions {
  planId: string;
}

export interface RecordDataOptions {
  data: string[];
}

export interface RecordQueryOptions {
  query: string;
}

export interface MembersExportOptions {
  format: string;
  output: string;
  all?: boolean;
}

export interface MembersImportOptions {
  file: string;
}

export interface MembersFindOptions {
  field?: string[];
  plan?: string;
}

export interface MembersBulkUpdateOptions {
  file: string;
  dryRun?: boolean;
}

export interface MembersBulkAddPlanOptions {
  filter: string;
  plan: string;
  dryRun?: boolean;
}

export interface RecordsExportOptions {
  format: string;
  output: string;
}

export interface RecordsImportOptions {
  file: string;
}

export interface RecordsFindOptions {
  where?: string[];
  take?: string;
  skip?: string;
}

export interface RecordsBulkUpdateOptions {
  file: string;
  tableKey?: string;
  dryRun?: boolean;
}

export interface RecordsBulkDeleteOptions {
  where?: string[];
  dryRun?: boolean;
}
