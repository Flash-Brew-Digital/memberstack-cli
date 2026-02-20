export interface PlanConnection {
  active: boolean;
  id: string;
  payment: unknown;
  plan: { id: string; name: string };
  status: string;
  type: string;
}

export interface Member {
  auth: {
    email: string;
  };
  createdAt: string;
  customFields?: Record<string, unknown>;
  id: string;
  json?: Record<string, unknown>;
  lastLogin?: string;
  loginRedirect?: string;
  metaData?: Record<string, unknown>;
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
  defaultValue: unknown;
  id: string;
  key: string;
  name: string;
  referencedTable?: {
    id: string;
    key: string;
    name: string;
  };
  referencedTableId: string | null;
  required: boolean;
  tableOrder: number;
  type: FieldType;
}

export type AccessRule =
  | "PUBLIC"
  | "AUTHENTICATED"
  | "AUTHENTICATED_OWN"
  | "ADMIN_ONLY";

export interface DataTable {
  createdAt: string;
  createRule: AccessRule;
  deleteRule: AccessRule;
  fields: TableField[];
  id: string;
  key: string;
  name: string;
  readRule: AccessRule;
  updatedAt: string;
  updateRule: AccessRule;
}

export interface DataRecord {
  createdAt: string;
  data: Record<string, unknown>;
  id: string;
  internalOrder: number;
  tableKey?: string;
  updatedAt: string;
}

export interface Plan {
  applyLogicToTeamMembers: boolean | null;
  copiedToLive: boolean | null;
  description: string | null;
  icon: string | null;
  id: string;
  image: string | null;
  isPaid: boolean | null;
  limitMembers: boolean | null;
  memberCount: number | null;
  memberLimit: number | null;
  name: string;
  permissions: unknown[];
  prices: unknown[];
  priority: number | null;
  restrictToAdmin: boolean | null;
  status: "ACTIVE" | "INACTIVE";
  teamAccountInviteSignupLink: string | null;
  teamAccountsEnabled: boolean | null;
  teamAccountUpgradeLink: string | null;
}

export interface PlansListOptions {
  orderBy?: "PRIORITY" | "CREATED_AT";
  status?: "ALL" | "ACTIVE" | "INACTIVE";
}

export interface PlansCreateOptions {
  description: string;
  icon?: string;
  isPaid?: boolean;
  name: string;
  teamAccountInviteSignupLink?: string;
  teamAccountsEnabled?: boolean;
  teamAccountUpgradeLink?: string;
}

export interface PlansUpdateOptions {
  description?: string;
  icon?: string;
  limitMembers?: boolean;
  memberLimit?: string;
  name?: string;
  restrictToAdmin?: boolean;
  status?: "ACTIVE" | "INACTIVE";
  teamAccountInviteSignupLink?: string;
  teamAccountUpgradeLink?: string;
}

export interface PlansOrderOptions {
  plan: string[];
}

export interface MembersListOptions {
  after?: string;
  all?: boolean;
  limit?: string;
  order?: "ASC" | "DESC";
}

export interface MembersCreateOptions {
  customFields?: string[];
  email: string;
  loginRedirect?: string;
  metaData?: string[];
  password: string;
  plans?: string[];
}

export interface MembersUpdateOptions {
  customFields?: string[];
  email?: string;
  jsonData?: string;
  loginRedirect?: string;
  metaData?: string[];
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
  all?: boolean;
  format: string;
  output: string;
}

export interface MembersImportOptions {
  file: string;
}

export interface MembersFindOptions {
  field?: string[];
  plan?: string;
}

export interface MembersBulkUpdateOptions {
  dryRun?: boolean;
  file: string;
}

export interface MembersBulkAddPlanOptions {
  dryRun?: boolean;
  filter: string;
  plan: string;
}

export interface RecordsExportOptions {
  format: string;
  output: string;
}

export interface RecordsImportOptions {
  file: string;
}

export interface RecordsFindOptions {
  skip?: string;
  take?: string;
  where?: string[];
}

export interface RecordsBulkUpdateOptions {
  dryRun?: boolean;
  file: string;
  tableKey?: string;
}

export interface RecordsBulkDeleteOptions {
  dryRun?: boolean;
  where?: string[];
}
