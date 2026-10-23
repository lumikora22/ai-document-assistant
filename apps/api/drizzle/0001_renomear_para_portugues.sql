-- Renomeia tabelas, colunas, índices e constraints para português, preservando os dados.
ALTER TABLE "notes" RENAME TO "notas";
--> statement-breakpoint
ALTER TABLE "notas" RENAME COLUMN "title" TO "titulo";
--> statement-breakpoint
ALTER TABLE "notas" RENAME COLUMN "type" TO "tipo";
--> statement-breakpoint
ALTER TABLE "notas" RENAME COLUMN "content" TO "conteudo";
--> statement-breakpoint
ALTER TABLE "notas" RENAME COLUMN "created_at" TO "criado_em";
--> statement-breakpoint
ALTER TABLE "notas" RENAME CONSTRAINT "notes_pkey" TO "notas_pkey";
--> statement-breakpoint
ALTER TABLE "note_entries" RENAME TO "entradas_nota";
--> statement-breakpoint
ALTER TABLE "entradas_nota" RENAME COLUMN "note_id" TO "nota_id";
--> statement-breakpoint
ALTER TABLE "entradas_nota" RENAME COLUMN "content" TO "conteudo";
--> statement-breakpoint
ALTER TABLE "entradas_nota" RENAME COLUMN "created_at" TO "criado_em";
--> statement-breakpoint
ALTER TABLE "entradas_nota" RENAME CONSTRAINT "note_entries_pkey" TO "entradas_nota_pkey";
--> statement-breakpoint
ALTER INDEX "idx_note_entries_note_id" RENAME TO "idx_entradas_nota_nota_id";
--> statement-breakpoint
ALTER TABLE "note_chunks" RENAME TO "trechos_nota";
--> statement-breakpoint
ALTER TABLE "trechos_nota" RENAME COLUMN "note_id" TO "nota_id";
--> statement-breakpoint
ALTER TABLE "trechos_nota" RENAME COLUMN "content" TO "conteudo";
--> statement-breakpoint
ALTER TABLE "trechos_nota" RENAME CONSTRAINT "note_chunks_pkey" TO "trechos_nota_pkey";
--> statement-breakpoint
ALTER INDEX "idx_note_chunks_note_id" RENAME TO "idx_trechos_nota_nota_id";
--> statement-breakpoint
-- As foreign keys podem ter o nome do Drizzle ou o nome padrão do Postgres (bancos
-- criados antes do Drizzle). Recria cada uma com o nome esperado pelo schema.
DO $$
DECLARE fk record;
BEGIN
	FOR fk IN
		SELECT conrelid::regclass AS tabela, conname
		FROM pg_constraint
		WHERE contype = 'f' AND conrelid IN ('entradas_nota'::regclass, 'trechos_nota'::regclass)
	LOOP
		EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tabela, fk.conname);
	END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "entradas_nota" ADD CONSTRAINT "entradas_nota_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trechos_nota" ADD CONSTRAINT "trechos_nota_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;
