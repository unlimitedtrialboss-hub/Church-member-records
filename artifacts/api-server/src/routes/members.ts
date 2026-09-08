import { Router, type IRouter } from "express";
import {
  CreateMemberBody,
  GetMemberParams,
  GetMemberQueryParams,
  GetMemberSummaryQueryParams,
  ListMembersQueryParams,
  ListNotionDatabasesQueryParams,
  UpdateMemberBody,
  UpdateMemberParams,
} from "@workspace/api-zod";
import {
  archiveMember,
  createMember,
  getMember,
  getMemberSummary,
  listMembers,
  searchDatabases,
  updateMember,
  type MemberRecord,
} from "../lib/notion";

const router: IRouter = Router();

function sendError(res: Parameters<NonNullable<Parameters<IRouter["get"]>[1]>>[1], error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong while contacting Notion.";
  res.status(message.includes("404") ? 404 : 502).json({ error: message });
}

function memberFromBody(body: Record<string, unknown>): MemberRecord {
  const nullIfBlank = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  const arrayValue = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
  return {
    name: String(body.name ?? "").trim(),
    dateFilled: nullIfBlank(body.dateFilled),
    address: nullIfBlank(body.address),
    contactNumber: nullIfBlank(body.contactNumber),
    gender: nullIfBlank(body.gender),
    birthDate: nullIfBlank(body.birthDate),
    birthPlace: nullIfBlank(body.birthPlace),
    citizenship: nullIfBlank(body.citizenship),
    civilStatus: nullIfBlank(body.civilStatus),
    spouse: nullIfBlank(body.spouse),
    children: arrayValue(body.children),
    father: nullIfBlank(body.father),
    mother: nullIfBlank(body.mother),
    emergencyContactPerson: nullIfBlank(body.emergencyContactPerson),
    emergencyContactNumber: nullIfBlank(body.emergencyContactNumber),
    hisHerAddress: nullIfBlank(body.hisHerAddress),
    elementarySchool: nullIfBlank(body.elementarySchool),
    highSchool: nullIfBlank(body.highSchool),
    college: nullIfBlank(body.college),
    degreeCourse: nullIfBlank(body.degreeCourse),
    dateOfSalvation: nullIfBlank(body.dateOfSalvation),
    dateOfBaptism: nullIfBlank(body.dateOfBaptism),
    dateOfMembership: nullIfBlank(body.dateOfMembership),
    churchPosition: nullIfBlank(body.churchPosition),
    ministryInterests: arrayValue(body.ministryInterests),
    otherMinistry: nullIfBlank(body.otherMinistry),
    specialSkills: nullIfBlank(body.specialSkills),
  };
}

function responseMember(page: Awaited<ReturnType<typeof getMember>>) {
  return {
    id: page.id,
    ...page.member,
    url: page.url,
    lastEditedTime: page.last_edited_time,
  };
}

router.get("/notion/databases", async (req, res) => {
  const parsed = ListNotionDatabasesQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid database search." });
  try {
    return res.json(await searchDatabases(parsed.data.query));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/members/summary", async (req, res) => {
  const parsed = GetMemberSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "A Notion database is required." });
  try {
    return res.json(await getMemberSummary(parsed.data.databaseId));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/members", async (req, res) => {
  const parsed = ListMembersQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "A Notion database is required." });
  try {
    return res.json(await listMembers(parsed.data.databaseId, parsed.data.query));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/members", async (req, res) => {
  const parsed = CreateMemberBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.databaseId) return res.status(400).json({ error: "A Notion database and member name are required." });
  try {
    const page = await createMember(parsed.data.databaseId, memberFromBody(parsed.data));
    return res.status(201).json({
      id: page.id,
      ...page.member,
      url: page.url,
      lastEditedTime: page.last_edited_time,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/members/:id", async (req, res) => {
  const params = GetMemberParams.safeParse(req.params);
  const query = GetMemberQueryParams.safeParse(req.query);
  if (!params.success || !query.success) return res.status(400).json({ error: "A member and Notion database are required." });
  try {
    const page = await getMember(params.data.id);
    if (page.parent?.database_id && page.parent.database_id !== query.data.databaseId) return res.status(404).json({ error: "Member not found." });
    return res.json(responseMember(page));
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch("/members/:id", async (req, res) => {
  const params = UpdateMemberParams.safeParse(req.params);
  const body = UpdateMemberBody.safeParse(req.body);
  if (!params.success || !body.success || !body.data.databaseId) return res.status(400).json({ error: "A Notion database and member name are required." });
  try {
    const page = await updateMember(params.data.id, memberFromBody(body.data));
    return res.json(responseMember(page));
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete("/members/:id", async (req, res) => {
  const params = GetMemberParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "A member is required." });
  try {
    await archiveMember(params.data.id);
    return res.status(204).send();
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;