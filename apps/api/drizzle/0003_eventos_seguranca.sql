CREATE TABLE "eventos_seguranca" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"origem" text NOT NULL,
	"acao" text NOT NULL,
	"nota_id" uuid,
	"pontuacao" real NOT NULL,
	"regras" jsonb NOT NULL,
	"trecho" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eventos_seguranca" ADD CONSTRAINT "eventos_seguranca_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_eventos_seguranca_criado_em" ON "eventos_seguranca" USING btree ("criado_em");