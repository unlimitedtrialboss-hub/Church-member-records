import { ReplitConnectors } from "@replit/connectors-sdk";

type NotionPage = {
  id: string;
  url: string;
  last_edited_time: string;
  parent?: { database_id?: string };
  properties: Record<string, NotionProperty>;
};

type NotionProperty = {
  type?: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
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
  properties?: Record<string, { type?: string }>;
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

function titlePropertyName(database: NotionDatabase): string {
  const entry = Object.entries(database.properties ?? {}).find(([, property]) => property.type === "title");
  if (!entry) throw new Error("The selected Notion database does not have a title property.");
  return entry[0];
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

function parseMember(page: NotionPage, blocks: NotionBlock[]): MemberRecord {
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

export async function listMembers(databaseId: string, query?: string) {
  const pages = await queryPages(databaseId, query);
  return pages.map((page) => ({
    id: page.id,
    name: plainText(Object.values(page.properties).find((property) => property.type === "title")) || "Unnamed member",
    url: page.url,
    lastEditedTime: page.last_edited_time,
    gender: null,
    civilStatus: null,
    churchPosition: null,
  }));
}

export async function createMember(databaseId: string, member: MemberRecord) {
  const database = await getDatabase(databaseId);
  const titleName = titlePropertyName(database);
  const response = await notionRequest("/pages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        [titleName]: { title: [{ type: "text", text: { content: member.name } }] },
      },
    }),
  });
  const page = await readJson<NotionPage>(response);
  await appendBlocks(page.id, recordBlocks(member));
  return { ...page, member };
}

export async function getMember(pageId: string) {
  const [page, blocks] = await Promise.all([getPage(pageId), getBlocks(pageId)]);
  return { ...page, member: parseMember(page, blocks) };
}

export async function updateMember(pageId: string, member: MemberRecord) {
  const page = await getPage(pageId);
  const titleName = Object.entries(page.properties).find(([, property]) => property.type === "title")?.[0];
  if (!titleName) throw new Error("The selected Notion page has no title property.");
  const pageResponse = await notionRequest(`/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      properties: { [titleName]: { title: [{ type: "text", text: { content: member.name } }] } },
    }),
  });
  const updatedPage = await readJson<NotionPage>(pageResponse);
  const blocks = await getBlocks(pageId);
  await deleteBlocks(blocks);
  await appendBlocks(pageId, recordBlocks(member));
  return { ...updatedPage, member };
}

export async function archiveMember(pageId: string) {
  const response = await notionRequest(`/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ archived: true }),
  });
  await readJson(response);
}

export async function getMemberSummary(databaseId: string) {
  const pages = await queryPages(databaseId);
  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentlyUpdated = pages.filter((page) => Date.parse(page.last_edited_time) >= recentCutoff).length;
  let ministryInterestCount = 0;
  for (const page of pages.slice(0, 100)) {
    const blocks = await getBlocks(page.id);
    const interestBlock = blocks.find((block) => blockText(block).startsWith("Ministry interests:"));
    if (interestBlock && !blockText(interestBlock).endsWith("—")) ministryInterestCount += 1;
  }
  return { total: pages.length, recentlyUpdated, ministryInterestCount };
}