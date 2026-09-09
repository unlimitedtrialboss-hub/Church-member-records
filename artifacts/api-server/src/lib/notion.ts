import { ReplitConnectors } from "@replit/connectors-sdk";

type NotionPage = {
  id: string;
  url: string;
  last_edited_time: string;
  parent?: { database_id?: string };
  properties: Record<string, NotionProperty>;
};

type NotionProperty = {
  id?: string;
  type?: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  select?: { name?: string } | null;
  date?: { start?: string | null } | null;
  phone_number?: string | null;
  relation?: Array<{ id: string }>;
};

type NotionBlock = {
  id: string;
  type: string;
  paragraph?: { rich_text?: Array<{ plain_text?: string }> };
  heading_2?: { rich_text?: Array<{ plain_text?: string }> };
  code?: { rich_text?: Array<{ plain_text?: string }> };
};

type NotionDatabase = {
  id: string;
  url: string;
  last_edited_time: string;
  title?: Array<{ plain_text?: string }>;
  properties?: Record<string, {
    id?: string;
    type?: string;
    select?: { options?: Array<{ name?: string }> };
    relation?: { database_id?: string; data_source_id?: string };
  }>;
};

type NotionListResponse<T> = {
  results: T[];
  has_more?: boolean;
  next_cursor?: string | null;
};

export type MemberRecord = {
  name: string;
  dateFilled: string | null;
  address: string | null;
  contactNumber: string | null;
  gender: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  citizenship: string | null;
  civilStatus: string | null;
  spouse: string | null;
  children: string[];
  father: string | null;
  mother: string | null;
  emergencyContactPerson: string | null;
  emergencyContactNumber: string | null;
  hisHerAddress: string | null;
  elementarySchool: string | null;
  highSchool: string | null;
  college: string | null;
  degreeCourse: string | null;
  dateOfSalvation: string | null;
  dateOfBaptism: string | null;
  dateOfMembership: string | null;
  churchPosition: string | null;
  ministryInterests: string[];
  otherMinistry: string | null;
  specialSkills: string | null;
};

const fieldLabels: Array<[keyof MemberRecord, string]> = [
  ["dateFilled", "Date filled"],
  ["address", "Address"],
  ["contactNumber", "Contact number"],
  ["gender", "Gender"],
  ["birthDate", "Birth date"],
  ["birthPlace", "Birth place"],
  ["citizenship", "Citizenship"],
  ["civilStatus", "Civil status"],
  ["spouse", "Spouse"],
  ["children", "Children"],
  ["father", "Father"],
  ["mother", "Mother"],
  ["emergencyContactPerson", "Emergency contact person"],
  ["emergencyContactNumber", "Emergency contact number"],
  ["hisHerAddress", "His/her address"],
  ["elementarySchool", "Elementary school"],
  ["highSchool", "High school"],
  ["college", "College"],
  ["degreeCourse", "Degree/course"],
  ["dateOfSalvation", "Date of salvation"],
  ["dateOfBaptism", "Date of baptism"],
  ["dateOfMembership", "Date of membership"],
  ["churchPosition", "Church position"],
  ["ministryInterests", "Ministry interests"],
  ["otherMinistry", "Other ministry"],
  ["specialSkills", "Special skills"],
];

const labelToField = new Map(fieldLabels.map(([field, label]) => [label, field]));

function notionText(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function plainText(property: NotionProperty | undefined): string {
  const values = property?.title ?? property?.rich_text ?? [];
  return values.map((item) => item.plain_text ?? "").join("").trim();
}

type NotionRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

async function notionRequest(path: string, init?: NotionRequestOptions): Promise<Response> {
  const connectors = new ReplitConnectors();
  return connectors.proxy("notion", `/v1${path}`, init);
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Notion request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

export async function searchDatabases(query?: string) {
  const response = await notionRequest("/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: query?.trim() || undefined,
      filter: { property: "object", value: "database" },
      page_size: 100,
      sort: { direction: "descending", timestamp: "last_edited_time" },
    }),
  });
  const data = await readJson<NotionListResponse<NotionDatabase>>(response);
  return data.results.map((database) => ({
    id: database.id,
    title: database.title?.map((item) => item.plain_text ?? "").join("").trim() || "Untitled database",
    url: database.url,
    lastEditedTime: database.last_edited_time,
  }));
}

async function getDatabase(databaseId: string): Promise<NotionDatabase> {
  const response = await notionRequest(`/databases/${encodeURIComponent(databaseId)}`);
  return readJson<NotionDatabase>(response);
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function databasePropertyName(database: NotionDatabase, ...names: string[]) {
  const properties = Object.keys(database.properties ?? {});
  for (const name of names) {
    const match = properties.find((candidate) => normalized(candidate) === normalized(name));
    if (match) return match;
  }
  return undefined;
}

function databaseRole(database: NotionDatabase) {
  const names = Object.keys(database.properties ?? {}).map(normalized);
  if (databasePropertyName(database, "Name") && names.includes(normalized("Contact Number"))) return "personal";
  if (databasePropertyName(database, "Record") && databasePropertyName(database, "Member") && names.includes(normalized("College"))) return "family";
  if (databasePropertyName(database, "Record") && databasePropertyName(database, "Member") && names.includes(normalized("Date of Baptism"))) return "church";
  return undefined;
}

async function resolveRegistryDatabases(databaseId: string) {
  const selected = await getDatabase(databaseId);
  const candidates = new Map<string, NotionDatabase>([[selected.id, selected]]);
  const searchResponse = await notionRequest("/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filter: { property: "object", value: "database" },
      page_size: 100,
    }),
  });
  const search = await readJson<NotionListResponse<NotionDatabase>>(searchResponse);
  await Promise.all((search.results ?? []).map(async (database) => {
    if (!candidates.has(database.id)) candidates.set(database.id, await getDatabase(database.id));
  }));
  const databases = [...candidates.values()];
  const personal = databases.find((database) => databaseRole(database) === "personal");
  const family = databases.find((database) => databaseRole(database) === "family");
  const church = databases.find((database) => databaseRole(database) === "church");
  if (!personal || !family || !church) {
    throw new Error("Notion must have Personal Information, Family Information, and Church and Ministry Information tables shared with this workspace.");
  }
  return { personal, family, church };
}

function titlePropertyName(database: NotionDatabase): string {
  const entry = Object.entries(database.properties ?? {}).find(([, property]) => property.type === "title");
  if (!entry) throw new Error("The selected Notion database does not have a title property.");
  return entry[0];
}

function propertyText(property: NotionProperty | undefined): string | null {
  if (!property) return null;
  if (property.type === "title" || property.type === "rich_text") return plainText(property) || null;
  if (property.type === "select") return property.select?.name ?? null;
  if (property.type === "date") return property.date?.start ?? null;
  if (property.type === "phone_number") return property.phone_number ?? null;
  return null;
}

function pagePropertyValue(page: NotionPage, ...names: string[]) {
  const name = Object.keys(page.properties).find((candidate) =>
    names.some((expected) => normalized(candidate) === normalized(expected)),
  );
  return propertyText(name ? page.properties[name] : undefined);
}

function propertyPayload(database: NotionDatabase, name: string, value: string | null | undefined) {
  const property = database.properties?.[name];
  if (!property) return undefined;
  if (property.type === "title") return { title: value ? [{ type: "text", text: { content: value } }] : [] };
  if (property.type === "rich_text") return { rich_text: value ? [{ type: "text", text: { content: value.slice(0, 1900) } }] : [] };
  if (property.type === "phone_number") return { phone_number: value || null };
  if (property.type === "date") return { date: value ? { start: value } : null };
  if (property.type === "select") {
    if (!value) return { select: null };
    const options = property.select?.options?.map((option) => option.name).filter((option): option is string => Boolean(option)) ?? [];
    return options.includes(value) ? { select: { name: value } } : undefined;
  }
  return undefined;
}

function relationPayload(database: NotionDatabase, name: string, pageId: string) {
  if (database.properties?.[name]?.type !== "relation") return undefined;
  return { relation: [{ id: pageId }] };
}

function personalProperties(database: NotionDatabase, member: MemberRecord) {
  const values: Record<string, string | null> = {
    Name: member.name,
    "Date Filed": member.dateFilled,
    Address: member.address,
    "Contact Number": member.contactNumber,
    Gender: member.gender,
    "Birth Date": member.birthDate,
    "Birth Place": member.birthPlace,
    Citizenship: member.citizenship,
    "Civil Status": member.civilStatus,
    Spouse: member.spouse,
    Children: member.children.join("; "),
    Father: member.father,
    Mother: member.mother,
    "Emergency Contact Person": member.emergencyContactPerson,
    "Emergency Contact Number": member.emergencyContactNumber,
    "Emergency Contact Address": member.hisHerAddress,
    "Baptism Status": member.dateOfBaptism ? "Baptized" : "Not Baptized",
  };
  return buildProperties(database, values);
}

function familyProperties(database: NotionDatabase, member: MemberRecord, personalPageId: string) {
  const values: Record<string, string | null> = {
    Record: member.name,
    "Elementary School": member.elementarySchool,
    "High School": member.highSchool,
    College: member.college,
    "Degree/Course": member.degreeCourse,
  };
  return {
    ...buildProperties(database, values),
    ...relationProperty(database, "Member", personalPageId),
  };
}

function churchProperties(database: NotionDatabase, member: MemberRecord, personalPageId: string) {
  const values: Record<string, string | null> = {
    Record: member.name,
    "Date of Salvation": member.dateOfSalvation,
    "Date of Baptism": member.dateOfBaptism,
    "Date of Membership": member.dateOfMembership,
    "Current Church Position": member.churchPosition,
    "Ministry Aspirations/Interests": member.ministryInterests.join("; "),
    Others: member.otherMinistry,
    "Special Skills": member.specialSkills,
  };
  return {
    ...buildProperties(database, values),
    ...relationProperty(database, "Member", personalPageId),
  };
}

function buildProperties(database: NotionDatabase, values: Record<string, string | null>) {
  const properties: Record<string, unknown> = {};
  for (const [label, value] of Object.entries(values)) {
    const name = databasePropertyName(database, label);
    if (!name) continue;
    const payload = propertyPayload(database, name, value);
    if (payload) properties[name] = payload;
  }
  return properties;
}

function relationProperty(database: NotionDatabase, label: string, pageId: string) {
  const name = databasePropertyName(database, label);
  if (!name) return {};
  const payload = relationPayload(database, name, pageId);
  return payload ? { [name]: payload } : {};
}

async function queryPages(databaseId: string, query?: string): Promise<NotionPage[]> {
  const database = await getDatabase(databaseId);
  const titleName = titlePropertyName(database);
  const body: Record<string, unknown> = { page_size: 100 };
  if (query?.trim()) {
    body.filter = { property: titleName, title: { contains: query.trim() } };
  }
  const response = await notionRequest(`/databases/${encodeURIComponent(databaseId)}/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson<NotionListResponse<NotionPage>>(response);
  return data.results;
}

async function getPage(pageId: string): Promise<NotionPage> {
  const response = await notionRequest(`/pages/${encodeURIComponent(pageId)}`);
  return readJson<NotionPage>(response);
}

async function getBlocks(pageId: string): Promise<NotionBlock[]> {
  const response = await notionRequest(`/blocks/${encodeURIComponent(pageId)}/children?page_size=100`);
  const data = await readJson<NotionListResponse<NotionBlock>>(response);
  return data.results;
}

function blockText(block: NotionBlock): string {
  const richText = block.paragraph?.rich_text ?? block.heading_2?.rich_text ?? block.code?.rich_text ?? [];
  return richText.map((item) => item.plain_text ?? "").join("").trim();
}

function emptyMember(name: string): MemberRecord {
  return {
    name,
    dateFilled: null,
    address: null,
    contactNumber: null,
    gender: null,
    birthDate: null,
    birthPlace: null,
    citizenship: null,
    civilStatus: null,
    spouse: null,
    children: [],
    father: null,
    mother: null,
    emergencyContactPerson: null,
    emergencyContactNumber: null,
    hisHerAddress: null,
    elementarySchool: null,
    highSchool: null,
    college: null,
    degreeCourse: null,
    dateOfSalvation: null,
    dateOfBaptism: null,
    dateOfMembership: null,
    churchPosition: null,
    ministryInterests: [],
    otherMinistry: null,
    specialSkills: null,
  };
}

function parseMember(page: NotionPage, blocks: NotionBlock[], familyPage?: NotionPage, churchPage?: NotionPage): MemberRecord {
  const title = Object.values(page.properties)
    .find((property) => property.type === "title");
  const member = emptyMember(plainText(title) || "Unnamed member");
  for (const block of blocks) {
    const text = blockText(block);
    const separator = text.indexOf(": ");
    if (separator < 0) continue;
    const field = labelToField.get(text.slice(0, separator));
    if (!field) continue;
    const value = text.slice(separator + 2).trim();
    if (field === "children" || field === "ministryInterests") {
      member[field] = value === "—" || !value ? [] : value.split(";").map((item) => item.trim()).filter(Boolean);
    } else {
      (member as unknown as Record<string, string | string[] | null>)[field] = value === "—" ? null : value;
    }
  }

  const personalFields: Array<[keyof MemberRecord, string]> = [
    ["dateFilled", "Date Filed"],
    ["address", "Address"],
    ["contactNumber", "Contact Number"],
    ["gender", "Gender"],
    ["birthDate", "Birth Date"],
    ["birthPlace", "Birth Place"],
    ["citizenship", "Citizenship"],
    ["civilStatus", "Civil Status"],
    ["spouse", "Spouse"],
    ["father", "Father"],
    ["mother", "Mother"],
    ["emergencyContactPerson", "Emergency Contact Person"],
    ["emergencyContactNumber", "Emergency Contact Number"],
  ];
  for (const [field, property] of personalFields) {
    const value = pagePropertyValue(page, property);
    if (value !== null) (member[field] as string | null) = value;
  }
  const children = pagePropertyValue(page, "Children");
  if (children !== null) member.children = children.split(";").map((item) => item.trim()).filter(Boolean);

  const familyFields: Array<[keyof MemberRecord, string]> = [
    ["elementarySchool", "Elementary School"],
    ["highSchool", "High School"],
    ["college", "College"],
    ["degreeCourse", "Degree/Course"],
  ];
  for (const [field, property] of familyFields) {
    const value = familyPage ? pagePropertyValue(familyPage, property) : null;
    if (value !== null) (member[field] as string | null) = value;
  }

  const churchFields: Array<[keyof MemberRecord, string]> = [
    ["dateOfSalvation", "Date of Salvation"],
    ["dateOfBaptism", "Date of Baptism"],
    ["dateOfMembership", "Date of Membership"],
    ["churchPosition", "Current Church Position"],
    ["otherMinistry", "Others"],
    ["specialSkills", "Special Skills"],
  ];
  for (const [field, property] of churchFields) {
    const value = churchPage ? pagePropertyValue(churchPage, property) : null;
    if (value !== null) (member[field] as string | null) = value;
  }
  const ministryInterests = churchPage ? pagePropertyValue(churchPage, "Ministry Aspirations/Interests") : null;
  if (ministryInterests !== null) member.ministryInterests = ministryInterests.split(";").map((item) => item.trim()).filter(Boolean);
  return member;
}

function recordBlocks(member: MemberRecord): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [
    heading("Personal information"),
    heading("Family information"),
  ];
  const sections: Array<[string, Array<keyof MemberRecord>]> = [
    ["Personal information", ["dateFilled", "address", "contactNumber", "gender", "birthDate", "birthPlace", "citizenship", "civilStatus", "spouse"]],
    ["Family information", ["children", "father", "mother", "emergencyContactPerson", "emergencyContactNumber", "hisHerAddress"]],
    ["Educational background", ["elementarySchool", "highSchool", "college", "degreeCourse"]],
    ["Church and ministry", ["dateOfSalvation", "dateOfBaptism", "dateOfMembership", "churchPosition", "ministryInterests", "otherMinistry", "specialSkills"]],
  ];
  blocks.length = 0;
  for (const [section, fields] of sections) {
    blocks.push(heading(section));
    for (const field of fields) {
      const label = fieldLabels.find(([candidate]) => candidate === field)?.[1] ?? field;
      const value = member[field];
      blocks.push(paragraph(`${label}: ${Array.isArray(value) ? notionText(value.join("; ")) : notionText(value)}`));
    }
  }
  return blocks;
}

function heading(text: string) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function paragraph(text: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: text.slice(0, 1900) } }] },
  };
}

async function deleteBlocks(blocks: NotionBlock[]) {
  await Promise.all(
    blocks.map(async (block) => {
      const response = await notionRequest(`/blocks/${encodeURIComponent(block.id)}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Unable to clear a Notion block (${response.status}).`);
      }
    }),
  );
}

async function appendBlocks(pageId: string, blocks: Array<Record<string, unknown>>) {
  const response = await notionRequest(`/blocks/${encodeURIComponent(pageId)}/children`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ children: blocks }),
  });
  await readJson(response);
}

async function createPage(database: NotionDatabase, properties: Record<string, unknown>) {
  const response = await notionRequest("/pages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      parent: { database_id: database.id },
      properties,
    }),
  });
  return readJson<NotionPage>(response);
}

async function updatePageProperties(pageId: string, properties: Record<string, unknown>) {
  const response = await notionRequest(`/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ properties }),
  });
  return readJson<NotionPage>(response);
}

async function relatedPages(database: NotionDatabase, personalPageId: string) {
  const relationName = databasePropertyName(database, "Member");
  if (!relationName) return [];
  const response = await notionRequest(`/databases/${encodeURIComponent(database.id)}/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      page_size: 10,
      filter: { property: relationName, relation: { contains: personalPageId } },
    }),
  });
  const data = await readJson<NotionListResponse<NotionPage>>(response);
  return data.results;
}

async function upsertRelatedPage(database: NotionDatabase, member: MemberRecord, personalPageId: string, properties: Record<string, unknown>) {
  const pages = await relatedPages(database, personalPageId);
  if (pages[0]) {
    return updatePageProperties(pages[0].id, properties);
  }
  return createPage(database, properties);
}

export async function listMembers(databaseId: string, query?: string) {
  const registry = await resolveRegistryDatabases(databaseId);
  const pages = await queryPages(registry.personal.id, query);
  return pages.map((page) => ({
    id: page.id,
    name: pagePropertyValue(page, "Name") || "Unnamed member",
    url: page.url,
    lastEditedTime: page.last_edited_time,
    gender: pagePropertyValue(page, "Gender"),
    civilStatus: pagePropertyValue(page, "Civil Status"),
    churchPosition: null,
  }));
}

export async function createMember(databaseId: string, member: MemberRecord) {
  const registry = await resolveRegistryDatabases(databaseId);
  const page = await createPage(registry.personal, personalProperties(registry.personal, member));
  await Promise.all([
    upsertRelatedPage(registry.family, member, page.id, familyProperties(registry.family, member, page.id)),
    upsertRelatedPage(registry.church, member, page.id, churchProperties(registry.church, member, page.id)),
  ]);
  return { ...page, member };
}

export async function getMember(pageId: string) {
  const page = await getPage(pageId);
  const registry = await resolveRegistryDatabases(page.parent?.database_id ?? "");
  const [blocks, familyPages, churchPages] = await Promise.all([
    getBlocks(pageId),
    relatedPages(registry.family, pageId),
    relatedPages(registry.church, pageId),
  ]);
  return { ...page, member: parseMember(page, blocks, familyPages[0], churchPages[0]) };
}

export async function updateMember(pageId: string, member: MemberRecord) {
  const page = await getPage(pageId);
  const registry = await resolveRegistryDatabases(page.parent?.database_id ?? "");
  const updatedPage = await updatePageProperties(pageId, personalProperties(registry.personal, member));
  await Promise.all([
    upsertRelatedPage(registry.family, member, pageId, familyProperties(registry.family, member, pageId)),
    upsertRelatedPage(registry.church, member, pageId, churchProperties(registry.church, member, pageId)),
  ]);
  const blocks = await getBlocks(pageId);
  await deleteBlocks(blocks);
  return { ...updatedPage, member };
}

export async function archiveMember(pageId: string) {
  const page = await getPage(pageId);
  const registry = await resolveRegistryDatabases(page.parent?.database_id ?? "");
  const [familyPages, churchPages] = await Promise.all([
    relatedPages(registry.family, pageId),
    relatedPages(registry.church, pageId),
  ]);
  await Promise.all([...familyPages, ...churchPages].map(async (relatedPage) => {
    const relatedResponse = await notionRequest(`/pages/${encodeURIComponent(relatedPage.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    await readJson(relatedResponse);
  }));
  const response = await notionRequest(`/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ archived: true }),
  });
  await readJson(response);
}

export async function getMemberSummary(databaseId: string) {
  const registry = await resolveRegistryDatabases(databaseId);
  const pages = await queryPages(registry.personal.id);
  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentlyUpdated = pages.filter((page) => Date.parse(page.last_edited_time) >= recentCutoff).length;
  const churchPages = await queryPages(registry.church.id);
  const ministryInterestCount = churchPages.filter((page) => Boolean(pagePropertyValue(page, "Ministry Aspirations/Interests"))).length;
  return { total: pages.length, recentlyUpdated, ministryInterestCount };
}