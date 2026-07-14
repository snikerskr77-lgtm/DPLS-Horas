import {
  pgTable,
  text,
  timestamp,
  integer,
  date,
  varchar,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";

// Employees table
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).unique(),
  department: varchar("department", { length: 100 }),
  position: varchar("position", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Time entries table
export const timeEntries = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id")
    .references(() => employees.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(),
  entryTime: varchar("entry_time", { length: 5 }).notNull(), // HH:MM format
  exitTime: varchar("exit_time", { length: 5 }), // HH:MM format, nullable for ongoing
  breakStart: varchar("break_start", { length: 5 }), // legacy single break start
  breakEnd: varchar("break_end", { length: 5 }), // legacy single break end
  breakTimes: text("break_times"), // JSON array of all break times: ["13:50","16:00","17:00","21:00"]
  totalMinutes: integer("total_minutes").default(0),
  notes: text("notes"),
  alerts: text("alerts"), // JSON array of alert strings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Absences table
export const absences = pgTable("absences", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id")
    .references(() => employees.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'unjustified', 'justified', 'vacation', 'sick'
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Settings table for Discord configuration
export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type Absence = typeof absences.$inferSelect;
export type NewAbsence = typeof absences.$inferInsert;
export type Setting = typeof settings.$inferSelect;
