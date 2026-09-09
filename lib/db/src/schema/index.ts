import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
	id: uuid("id").primaryKey(),
	fullName: text("full_name"),
	role: text("role").notNull().default("admin"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
	id: uuid("id").defaultRandom().primaryKey(),
	actorId: uuid("actor_id").notNull(),
	action: text("action").notNull(),
	entityType: text("entity_type").notNull(),
	entityId: text("entity_id"),
	details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const members = pgTable("members", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	dateFilled: text("date_filled"),
	address: text("address"),
	contactNumber: text("contact_number"),
	gender: text("gender"),
	birthDate: text("birth_date"),
	birthPlace: text("birth_place"),
	citizenship: text("citizenship"),
	recentPicture: text("recent_picture"),
	civilStatus: text("civil_status"),
	spouse: text("spouse"),
	children: text("children").array().notNull().default([]),
	father: text("father"),
	mother: text("mother"),
	emergencyContactPerson: text("emergency_contact_person"),
	emergencyContactNumber: text("emergency_contact_number"),
	hisHerAddress: text("his_her_address"),
	elementarySchool: text("elementary_school"),
	highSchool: text("high_school"),
	college: text("college"),
	degreeCourse: text("degree_course"),
	dateOfSalvation: text("date_of_salvation"),
	dateOfBaptism: text("date_of_baptism"),
	dateOfMembership: text("date_of_membership"),
	churchPosition: text("church_position"),
	ministryInterests: text("ministry_interests").array().notNull().default([]),
	otherMinistry: text("other_ministry"),
	specialSkills: text("special_skills"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	archivedAt: timestamp("archived_at", { withTimezone: true }),
});