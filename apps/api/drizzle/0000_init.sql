-- Migration inicial. É idempotente para que bancos criados pelo antigo INIT_SQL
-- (antes do Drizzle) sejam aproveitados sem erros.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "note_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(384) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "note_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Bancos antigos já têm essas foreign keys com os nomes padrão do Postgres.
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'note_chunks'::regclass AND contype = 'f') THEN
		ALTER TABLE "note_chunks" ADD CONSTRAINT "note_chunks_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'note_entries'::regclass AND contype = 'f') THEN
		ALTER TABLE "note_entries" ADD CONSTRAINT "note_entries_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_note_chunks_note_id" ON "note_chunks" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_note_entries_note_id" ON "note_entries" USING btree ("note_id");
