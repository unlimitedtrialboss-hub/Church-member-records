import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { members } from "@workspace/db/schema";
import type { MemberRecord } from "./notion.js";

const databaseId = "supabase-members";

function summary(row: typeof members.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    url: `/members/${row.id}`,
    lastEditedTime: row.updatedAt.toISOString(),
    gender: row.gender,
    civilStatus: row.civilStatus,
    churchPosition: row.churchPosition,
    recentPicture: row.recentPicture,
  };
}

function response(row: typeof members.$inferSelect) {
  return {
    ...summary(row),
    databaseId,
    dateFilled: row.dateFilled,
    address: row.address,
    contactNumber: row.contactNumber,
    birthDate: row.birthDate,
    birthPlace: row.birthPlace,
    citizenship: row.citizenship,
    recentPicture: row.recentPicture,
    spouse: row.spouse,
    children: row.children,
    father: row.father,
    mother: row.mother,
    emergencyContactPerson: row.emergencyContactPerson,
    emergencyContactNumber: row.emergencyContactNumber,
    hisHerAddress: row.hisHerAddress,
    elementarySchool: row.elementarySchool,
    highSchool: row.highSchool,
    college: row.college,
    degreeCourse: row.degreeCourse,
    dateOfSalvation: row.dateOfSalvation,
    dateOfBaptism: row.dateOfBaptism,
    dateOfMembership: row.dateOfMembership,
    ministryInterests: row.ministryInterests,
    otherMinistry: row.otherMinistry,
    specialSkills: row.specialSkills,
  };
}

function values(member: MemberRecord) {
  return {
    name: member.name,
    dateFilled: member.dateFilled,
    address: member.address,
    contactNumber: member.contactNumber,
    gender: member.gender,
    birthDate: member.birthDate,
    birthPlace: member.birthPlace,
    citizenship: member.citizenship,
    recentPicture: member.recentPicture,
    civilStatus: member.civilStatus,
    spouse: member.spouse,
    children: member.children,
    father: member.father,
    mother: member.mother,
    emergencyContactPerson: member.emergencyContactPerson,
    emergencyContactNumber: member.emergencyContactNumber,
    hisHerAddress: member.hisHerAddress,
    elementarySchool: member.elementarySchool,
    highSchool: member.highSchool,
    college: member.college,
    degreeCourse: member.degreeCourse,
    dateOfSalvation: member.dateOfSalvation,
    dateOfBaptism: member.dateOfBaptism,
    dateOfMembership: member.dateOfMembership,
    churchPosition: member.churchPosition,
    ministryInterests: member.ministryInterests,
    otherMinistry: member.otherMinistry,
    specialSkills: member.specialSkills,
    updatedAt: new Date(),
  };
}

export async function listMembers(_databaseId: string, query?: string) {
  const condition = query?.trim()
    ? and(isNull(members.archivedAt), ilike(members.name, `%${query.trim()}%`))
    : isNull(members.archivedAt);
  const rows = await db.select().from(members).where(condition).orderBy(desc(members.updatedAt));
  return rows.map(summary).sort(compareMemberNames);
}

function compareMemberNames(left: { name: string }, right: { name: string }) {
  const surname = (name: string) => name.trim().split(/\s+/).filter(Boolean).at(-1) ?? '';
  return surname(left.name).localeCompare(surname(right.name), undefined, { sensitivity: 'base' }) || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}

export async function getMemberSummary(_databaseId: string) {
  const rows = await db.select().from(members).where(isNull(members.archivedAt));
  return {
    total: rows.length,
    recentlyUpdated: rows.filter((row) => row.updatedAt.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000).length,
    ministryInterestCount: rows.filter((row) => row.ministryInterests.length > 0).length,
  };
}

export async function getMember(id: string) {
  const [row] = await db.select().from(members).where(and(eq(members.id, id), isNull(members.archivedAt))).limit(1);
  if (!row) throw new Error("404: Member not found.");
  return { id: row.id, member: response(row), url: `/members/${row.id}`, last_edited_time: row.updatedAt.toISOString() };
}

export async function createMember(_databaseId: string, member: MemberRecord) {
  const [row] = await db.insert(members).values(values(member)).returning();
  return { id: row.id, member: response(row), url: `/members/${row.id}`, last_edited_time: row.updatedAt.toISOString() };
}

export async function updateMember(id: string, member: MemberRecord) {
  const [row] = await db.update(members).set(values(member)).where(and(eq(members.id, id), isNull(members.archivedAt))).returning();
  if (!row) throw new Error("404: Member not found.");
  return { id: row.id, member: response(row), url: `/members/${row.id}`, last_edited_time: row.updatedAt.toISOString() };
}

export async function archiveMember(id: string) {
  const [row] = await db.update(members).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(members.id, id), isNull(members.archivedAt))).returning({ id: members.id });
  if (!row) throw new Error("404: Member not found.");
}